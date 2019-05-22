/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import Config from '../config';
import {
  createDatastore,
  FirestoreDatastore,
  InMemoryDatastore
} from '../lib/db';
import { ServiceNotificationProcessor } from '../lib/notificationProcessor';

declare function require(name: string): any;

const mozlog = require('mozlog')(Config.get('log'));
const logger = mozlog('event-broker-notification-processor');
const db =
  Config.get('firestore.projectId') === ''
    ? createDatastore(InMemoryDatastore, {})
    : createDatastore(FirestoreDatastore, Config.get('firestore'));

const processor = new ServiceNotificationProcessor(
  logger,
  db,
  Config.get('serviceNotificationQueueUrl')
);
processor.start();
