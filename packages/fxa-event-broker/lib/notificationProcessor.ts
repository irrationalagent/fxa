/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { SQS } from 'aws-sdk';
import * as Joi from 'joi';
import { Consumer } from 'sqs-consumer';

import { Datastore } from './db';

// Event strings
const LOGIN_EVENT = 'login';
const SUBSCRIPTION_UPDATE_EVENT = 'subscription:update';

// Message schemas
const BASE_MESSAGE_SCHEMA = Joi.object().keys({
  event: Joi.string()
    .valid(LOGIN_EVENT, SUBSCRIPTION_UPDATE_EVENT)
    .required(),
  uid: Joi.string().required()
});

const LOGIN_SCHEMA = Joi.object().keys({
  clientId: Joi.string().required(),
  deviceCount: Joi.number()
    .integer()
    .required(),
  email: Joi.string().required(),
  service: Joi.string().required(),
  userAgent: Joi.string().required()
});

const SUBSCRIPTION_UPDATE_SCHEMA = Joi.object().keys({
  isActive: Joi.bool().required(),
  productCapabilities: Joi.array()
    .items(Joi.string())
    .required(),
  productName: Joi.string().required(),
  subscriptionId: Joi.string().required()
});

class ServiceNotificationProcessor {
  private readonly app: Consumer;
  private readonly logger: any;
  private readonly db: Datastore;

  constructor(logger: any, db: Datastore, queueUrl: string) {
    this.db = db;
    this.logger = logger;
    this.app = Consumer.create({
      handleMessage: this.handleMessage,
      queueUrl,
      sqs: new SQS()
    });
  }

  public start() {
    this.app.start();
  }

  private async handleMessage(sqsMessage: SQS.Message) {
    let body;
    let message;
    try {
      body = JSON.parse(sqsMessage.Body || '{}');
      message = JSON.parse(body.Message);
    } catch (e) {
      // This will only catch deserialization errors
      this.logger.error('messageFetch', { err: e });
      return;
    }
    const baseValidationResult = Joi.validate(message, BASE_MESSAGE_SCHEMA);
    if (baseValidationResult.error) {
      // Ignore messages we're not interested in.
      return;
    }
    switch (message.event) {
      case LOGIN_EVENT: {
        const loginValidationResult = Joi.validate(message, LOGIN_SCHEMA);
        if (loginValidationResult.error) {
          this.logger.error('handleMessage', {
            event: LOGIN_EVENT,
            uid: message.uid,
            validationError: loginValidationResult.error
          });
          return;
        }
        this.db.storeLogin(message.uid, message.clientId);
        return;
      }
      case SUBSCRIPTION_UPDATE_EVENT: {
        const subValidationResult = Joi.validate(
          message,
          SUBSCRIPTION_UPDATE_SCHEMA
        );
        if (subValidationResult.error) {
          this.logger.error('handleMessage', {
            event: SUBSCRIPTION_UPDATE_EVENT,
            uid: message.uid,
            validationError: subValidationResult.error
          });
          return;
        }

        const clientIds = this.db.fetchClientIds(message.uid);
        // TODO: Queue a subscription event for each clientId for delivery.
        return;
      }
    }
    // This shouldn't occur or validation has failed in ugly ways
    this.logger.error('unreachableMessage', { message });
  }
}

export { ServiceNotificationProcessor };
