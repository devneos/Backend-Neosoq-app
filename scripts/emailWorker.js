const { dequeueJob } = require('../utils/fileQueue');
const { sendTemplateEmailWithAttachment } = require('../helpers/auth');
const path = require('path');

const processJob = async (item) => {
  const { job } = item;
  if (job.type === 'listing_email') {
    try {
      // normalize first file (if any) into { path, originalname, urlSrc, buffer }
      let fileObj = null;
      if (Array.isArray(job.files) && job.files.length) {
        const f = job.files[0];
        fileObj = {
          originalname: f.originalname || f.filename,
          path: f.path || null,
          urlSrc: f.urlSrc || null,
          buffer: f.buffer || null,
        };
      }
      await sendTemplateEmailWithAttachment(job.to, job.message, job.subject, fileObj);
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
