#!/usr/bin/env node
/*
  BullMQ-backed notification worker.
  - Listens to the `notifications` queue and processes jobs (notificationId)
  - Uses exponential backoff and attempts configured when jobs are added
  - Marks Notification.delivered on success
*/
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const dbConn = require('../config/dbConn');
const Notification = require('../models/Notification');
const User = require('../models/User');
const { sendTemplateEmail } = require('../helpers/auth');

const { Worker, QueueScheduler } = require('bullmq');

const QUEUE_NAME = process.env.NOTIFICATION_QUEUE_NAME || 'notifications';
const connection = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: Number(process.env.REDIS_PORT || 6379),
};

async function start() {
  await dbConn.connectDB();
  console.info('Connected DB for BullMQ worker');

  // scheduler (required for retries / delayed jobs)
  const scheduler = new QueueScheduler(QUEUE_NAME, { connection });
  scheduler.waitUntilReady().then(() => console.info('QueueScheduler ready'));

  const worker = new Worker(
    QUEUE_NAME,
    async (job) => {
      const { notificationId } = job.data;
      const n = await Notification.findById(notificationId);
      if (!n) {
        console.warn('Job references missing notification', notificationId);
        return true;
      }

      // Resolve recipient
      const user = n.userId ? await User.findById(n.userId).select('email fullname').lean() : null;
      const to = (user && user.email) ? user.email : (n.data && n.data.email);
      if (!to) {
        // Nothing we can do, mark delivered to avoid loops
        n.delivered = true;
        n.deliveredAt = new Date();
        await n.save();
        console.warn('Notification job: no recipient email, marked delivered', n._id.toString());
        return true;
      }

      const subject = n.title || `Notification: ${n.type}`;
      const message = n.body || (n.data && n.data.message) || '';
      await sendTemplateEmail(to, message, subject);

      n.delivered = true;
      n.deliveredAt = new Date();
      await n.save();
      console.info('Notification delivered via queue', n._id.toString(), 'to', to);
      return true;
    },
    { connection, concurrency: Number(process.env.NOTIFICATION_WORKER_CONCURRENCY || 5) }
  );

  worker.on('failed', (job, err) => {
    console.error('Job failed', job.id, err && err.message ? err.message : err);
  });

  worker.on('completed', (job) => {
    console.info('Job completed', job.id);
  });

  process.on('SIGINT', async () => {
    console.info('Shutting down worker...');
    await worker.close();
    process.exit(0);
  });

  console.info('Notification queue worker started, waiting for jobs...');
}

if (require.main === module) start().catch((err) => {
  console.error('Worker error', err && err.message ? err.message : err);
  process.exit(1);
});

module.exports = { start };
