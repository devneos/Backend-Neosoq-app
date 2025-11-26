#!/usr/bin/env node
/*
  Simple notification worker:
  - Connects to MongoDB using existing `config/dbConn.js`
  - Polls undelivered notifications and sends emails using `helpers/auth.js` `sendTemplateEmail`
  - Marks notifications as delivered on success, increments `deliveryAttempts` on failure
  - Intended as a minimal, single-process worker. For production use a persistent queue is recommended.
*/
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const dbConn = require('../config/dbConn');
const Notification = require('../models/Notification');
const User = require('../models/User');
const { sendTemplateEmail } = require('../helpers/auth');

const POLL_INTERVAL_MS = Number(process.env.NOTIFICATION_WORKER_POLL_MS || 5000);
const MAX_ATTEMPTS = Number(process.env.NOTIFICATION_WORKER_MAX_ATTEMPTS || 5);

async function processNotifications() {
  try {
    // Find undelivered notifications with limited delivery attempts
    const notifications = await Notification.find({ delivered: false, deliveryAttempts: { $lt: MAX_ATTEMPTS } }).limit(20).exec();
    if (!notifications.length) return;

    for (const n of notifications) {
      try {
        // Attempt to fetch recipient email
        const user = n.userId ? await User.findById(n.userId).select('email fullname').lean() : null;
        const to = (user && user.email) ? user.email : (n.data && n.data.email);
        if (!to) {
          // Nothing we can do: mark delivered to avoid infinite loop
          n.delivered = true;
          n.deliveredAt = new Date();
          await n.save();
          console.warn('Notification has no recipient email, marking delivered:', n._id.toString());
          continue;
        }

        const subject = n.title || `Notification: ${n.type}`;
        const message = n.body || (n.data && n.data.message) || '';

        await sendTemplateEmail(to, message, subject);

        n.delivered = true;
        n.deliveredAt = new Date();
        await n.save();
        console.info('Delivered notification', n._id.toString(), 'to', to);
      } catch (err) {
        console.error('Error delivering notification', n._id.toString(), err && err.message ? err.message : err);
        n.deliveryAttempts = (n.deliveryAttempts || 0) + 1;
        await n.save();
      }
    }
  } catch (err) {
    console.error('Notification worker error:', err && err.message ? err.message : err);
  }
}

async function main() {
  try {
    await dbConn.connectDB();
    console.info('Notification worker connected to DB');

    // Run loop
    while (true) {
      await processNotifications();
      await new Promise((res) => setTimeout(res, POLL_INTERVAL_MS));
    }
  } catch (err) {
    console.error('Worker fatal error:', err && err.message ? err.message : err);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { processNotifications };
