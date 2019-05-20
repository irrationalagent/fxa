/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

'use strict';

const fs = require('fs');
const path = require('path');
const convict = require('convict');

const conf = convict({
  env: {
    default: 'production',
    doc: 'The current node.js environment',
    env: 'NODE_ENV',
    format: [ 'development', 'production' ],
  },
  listen: {
    host: {
      default: '127.0.0.1',
      doc: 'The ip address the server should bind',
      env: 'IP_ADDRESS',
      format: 'ipaddress',
    },
    port: {
      default: 7100,
      doc: 'The port the server should bind',
      env: 'PORT',
      format: 'port',
    },
    publicUrl: {
      default: 'http://127.0.0.1:3031',
      env: 'PUBLIC_URL',
      format: 'url',
    },
  },
  logging: {
    app: { default: 'support-panel' },
    fmt: {
      default: 'heka',
      env: 'LOGGING_FORMAT',
      format: [
        'heka',
        'pretty'
      ],
    },
    level: {
      default: 'info',
      env: 'LOG_LEVEL'
    },
    routes: {
      enabled: {
        default: true,
        doc: 'Enable route logging. Set to false to trimming CI logs.',
        env: 'ENABLE_ROUTE_LOGGING'
      },
      format: {
        default: 'default_fxa',
        format: [
          'default_fxa',
          'dev_fxa',
          'default',
          'dev',
          'short',
          'tiny'
        ]
      },
    },
  },
});

// handle configuration files.  you can specify a CSV list of configuration
// files to process, which will be overlayed in order, in the CONFIG_FILES
// environment variable.

let envConfig = path.join(__dirname, `${conf.get('env')  }.json`);
envConfig = `${envConfig  },${  process.env.CONFIG_FILES || ''}`;
const files = envConfig.split(',').filter(fs.existsSync);
conf.loadFile(files);
conf.validate({ allowed: 'strict' });


module.exports = conf;
