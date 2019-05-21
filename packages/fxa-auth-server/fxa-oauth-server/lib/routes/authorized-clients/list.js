/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const hex = require('buf').to.hex;
const Joi = require('joi');

const config = require('../../config');
const db = require('../../db');
const validators = require('../../validators');
const verifyAssertion = require('../../assertion');
const ScopeSet = require('fxa-shared').oauth.scopes;
const localizeTimestamp = require('fxa-shared').l10n.localizeTimestamp({
  supportedLanguages: config.get('i18n.supportedLanguages'),
  defaultLanguage: config.get('i18n.defaultLanguage')
});

// Helper function to render each returned record in the expected form.
function serialize(clientIdHex, token, acceptLanguage) {
  var lastAccessTime = token.lastUsedAt.getTime();
  var lastAccessTimeFormatted = localizeTimestamp.format(lastAccessTime, acceptLanguage);
  return {
    client_id: clientIdHex,
    refresh_token_id: token.refreshTokenId ? hex(token.refreshTokenId) : undefined,
    client_name: token.clientName,
    last_access_time: lastAccessTime,
    last_access_time_formatted: lastAccessTimeFormatted,
    // Sort the scopes alphabetically, for consistent output.
    scope: token.scope.getScopeValues().sort(),
  };
}

// A simple `Map` wrapper that automatically sets a default value
// the first time a key is accessed.
class DefaultMap {
  constructor(makeDefault) {
    this._makeDefault = makeDefault;
    this._map = new Map();
  }

  get(key) {
    let value = this._map.get(key);
    if (typeof value === 'undefined') {
      value = this._makeDefault(key);
      this._map.set(key, value);
    }
    return value;
  }

  values() {
    return this._map.values();
  }
}

module.exports = {
  validate: {
    payload: {
      assertion: validators.assertion.required(),
    }
  },
  response: {
    schema: Joi.array().items(Joi.object({
      client_id: validators.clientId,
      refresh_token_id: validators.token.optional(),
      client_name: Joi.string().required(),
      last_access_time: Joi.number().min(0).required().allow(null),
      last_access_time_formatted: Joi.string().optional().allow(''),
      scope: Joi.array().items(Joi.string()).required(),
    }))
  },
  handler: async function(req) {
    const claims = await verifyAssertion(req.payload.assertion);
    const authorizedClients = [];

    // First, enumerate all the refresh tokens.
    // Each of these is a separate instance of an authorized client
    // and should be displayed to the user as such. Nice and simple!
    const scopesByClientId = new DefaultMap(() => ScopeSet.fromArray([]));
    for (const token of await db.getRefreshTokensByUid(claims.uid)) {
      const clientId = hex(token.clientId);
      authorizedClients.push(serialize(clientId, token, req.headers['accept-language']));
      scopesByClientId.get(clientId).add(token.scope);
    }

    // Next, enumerate all the access tokens. In the interests of giving the user a
    // complete-yet-comprehensible list of all the things attached to their account,
    // we want to:
    //
    //  1. Return a single unified record for any client that is not
    //     using refresh tokens.
    //  2. Return a record for any client that has an access token with more
    //     scopes than any of its refresh tokens.
    //  3. Avoid showing access tokens for `canGrant` clients; such clients will always
    //     hold some other sort of token, and we don't want them to appear in the list twice.
    //
    // Well-behaved clients should not ever find themselves in state (2), but fortunately
    // for us, doing (1) is basically a special case of doing (2) anyway, so it doesn't cost
    // us any extra work to make sure such misbehaving clients are visible.
    //
    // One day, if access tokens become limited to some sufficiently-short lifetime, we
    // may be able to simplify all this away by just not showing any access tokens
    // in the user's "devices and apps" list.
    const accessTokenRecordsById = new DefaultMap(key => {
      return {
        clientId: key,
        clientName: '',
        lastUsedAt: 0,
        scope: ScopeSet.fromArray([]),
      };
    });
    for (const token of await db.getAccessTokensByUid(claims.uid)) {
      const clientId = hex(token.client_id);
      const seenScopes = scopesByClientId.get(clientId);
      if (! seenScopes.contains(token.scope) && ! token.canGrant) {
        const record = accessTokenRecordsById.get(clientId);
        // Merge details of all access tokens into a single record.
        record.clientName = token.clientName;
        record.scope.add(token.scope);
        if (record.lastUsedAt < token.createdAt) {
          record.lastUsedAt = token.createdAt;
        }
      }
    }
    for (const [clientId, record] of accessTokenRecordsById.values()) {
      authorizedClients.push(serialize(clientId, record, req.headers['accept-language']));
    }

    // Sort the final list first by last_access_time, then by client_name
    authorizedClients.sort(function (a, b) {
      if (b.last_access_time > a.last_access_time) {
        return 1;
      }
      if (b.last_access_time < a.last_access_time) {
        return -1;
      }
      if (a.client_name > b.client_name) {
        return 1;
      }
      if (a.client_name < b.client_name) {
        return -1;
      }
      return 0;
    });

    return authorizedClients;
  }
};
