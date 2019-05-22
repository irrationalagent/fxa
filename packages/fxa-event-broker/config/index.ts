/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import * as Convict from 'convict';
import * as Fs from 'fs';
import * as Path from 'path';

const conf = Convict({
  env: {
    default: 'prod',
    doc: 'The current node.js environment',
    env: 'NODE_ENV',
    format: ['dev', 'test', 'stage', 'prod']
  },
  firestore: {
    credentials: {
      client_email: {
        default: '',
        doc: 'GCP Client key credential',
        env: 'FIRESTORE_CLIENT_EMAIL_CREDENTIAL',
        format: String
      },
      private_key: {
        default: '',
        doc: 'GCP Private key credential',
        env: 'FIRESTORE_PRIVATE_KEY_CREDENTIAL',
        format: String
      }
    },
    keyFilename: {
      default: '',
      doc: 'Path to GCP key file',
      env: 'FIRESTORE_KEY_FILE',
      format: String
    },
    projectId: {
      default: '',
      doc: 'GCP Project id',
      env: 'FIRESTORE_PROJECT_ID',
      format: String
    }
  },
  log: {
    app: {
      default: 'fxa-event-broker',
      env: 'LOG_APP_NAME'
    },
    fmt: {
      default: 'heka',
      env: 'LOG_FORMAT',
      format: ['heka', 'pretty']
    },
    level: {
      default: 'info',
      env: 'LOG_LEVEL'
    }
  },
  sentryDsn: {
    default: '',
    doc: 'Sentry DSN for error and log reporting',
    env: 'SENTRY_DSN',
    format: 'String'
  },
  serviceNotificationQueueUrl: {
    default: '',
    doc:
      'The queue URL to use (should include https://sqs.<region>.amazonaws.com/<account-id>/<queue-name>)',
    env: 'SERVICE_NOTIFICATION_QUEUE_URL',
    format: String
  }
});

// handle configuration files.  you can specify a CSV list of configuration
// files to process, which will be overlayed in order, in the CONFIG_FILES
// environment variable.

let envConfig = Path.join(__dirname, `${conf.get('env')}.json`);
envConfig = `${envConfig},${process.env.CONFIG_FILES || ''}`;
const files = envConfig.split(',').filter(Fs.existsSync);
conf.loadFile(files);
conf.validate({ allowed: 'strict' });
const Config = conf;

export default Config;
