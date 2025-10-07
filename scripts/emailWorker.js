const { dequeueJob } = require('../utils/fileQueue');
const { sendTemplateEmailWithAttachment } = require('../helpers/auth');
const path = require('path');

const processJob = async (item) => {
  const { job } = item;
  if (job.type === 'listing_email') {
    try {
      // prepare attachments: prefer urlSrc (no attachment) but include local paths if present
      const attachments = (job.files || []).map(f => ({ filename: f.originalname, path: f.path })).filter(a => a.path);
      if (attachments.length) {
        await sendTemplateEmailWithAttachment(job.to, job.message, job.subject, attachments[0]);
      } else {
        // fallback to simple templated email without attachment
        await sendTemplateEmailWithAttachment(job.to, job.message, job.subject, null);
      }
      console.log('Processed job', item.id);
    } catch (e) {
      console.error('Failed to process job', item.id, e);
      // re-enqueue failed job at end of queue with small delay
      // For simplicity, we'll re-add immediately
      const { enqueueJob } = require('../utils/fileQueue');
      await enqueueJob(job);
    }
  } else {
    console.warn('Unknown job type', job.type);
  }
};

const main = async () => {
  const argWatch = process.argv.includes('--watch');
  do {
    const item = dequeueJob();
    if (!item) {
      if (argWatch) await new Promise(r => setTimeout(r, 3000));
      else break;
    } else {
      await processJob(item);
    }
  } while (argWatch);
};

main().catch(e => { console.error(e); process.exit(1); });
