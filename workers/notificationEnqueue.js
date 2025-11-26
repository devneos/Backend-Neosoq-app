#!/usr/bin/env node
/*
  Enqueue undelivered notifications into BullMQ queue.
  This script is intended to be run periodically (cron) or manually to push DB notifications
  into the persistent queue so workers can process them with retries/backoff.
*/
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const dbConn = require('../config/dbConn');
const Notification = require('../models/Notification');
const { Queue } = require('bullmq');

const QUEUE_NAME = process.env.NOTIFICATION_QUEUE_NAME || 'notifications';
const connection = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: Number(process.env.REDIS_PORT || 6379),
};

const MAX_ATTEMPTS = Number(process.env.NOTIFICATION_WORKER_MAX_ATTEMPTS || 5);
const BACKOFF_MS = Number(process.env.NOTIFICATION_WORKER_BACKOFF_MS || 60 * 1000); // base delay

async function enqueue() {
  await dbConn.connectDB();
  const queue = new Queue(QUEUE_NAME, { connection });

  const notifications = await Notification.find({ delivered: false, deliveryAttempts: { $lt: MAX_ATTEMPTS } }).limit(100).lean();
  if (!notifications.length) {
    console.info('No notifications to enqueue');
    await queue.close();
    return;
  }

  for (const n of notifications) {
    try {
      await queue.add(
        'notify',
        { notificationId: n._id.toString() },
        {
          attempts: MAX_ATTEMPTS,
          backoff: { type: 'exponential', delay: BACKOFF_MS },
          removeOnComplete: { age: 60 * 60 },
          removeOnFail: { age: 24 * 60 * 60 },
        }
      );
      console.info('Enqueued notification', n._id.toString());
    } catch (err) {
      console.error('Failed to enqueue', n._id.toString(), err && err.message ? err.message : err);
    }
  }

  await queue.close();
}

if (require.main === module) {
  enqueue()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Enqueue fatal', err && err.message ? err.message : err);
      process.exit(1);
    });
}

module.exports = { enqueue };
