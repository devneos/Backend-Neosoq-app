const fs = require('fs');
const path = require('path');

const QUEUE_DIR = path.join(__dirname, '..', '.queue');
const QUEUE_FILE = path.join(QUEUE_DIR, 'jobs.json');

fs.mkdirSync(QUEUE_DIR, { recursive: true });
if (!fs.existsSync(QUEUE_FILE)) fs.writeFileSync(QUEUE_FILE, JSON.stringify([]));

const readQueue = () => {
  try {
    const raw = fs.readFileSync(QUEUE_FILE, 'utf8');
    return JSON.parse(raw || '[]');
  } catch (e) {
    return [];
  }
};

const writeQueue = (jobs) => {
  fs.writeFileSync(QUEUE_FILE, JSON.stringify(jobs, null, 2));
};

const enqueueJob = async (job) => {
  const jobs = readQueue();
  jobs.push({ id: Date.now() + '-' + Math.round(Math.random()*1e9), createdAt: new Date().toISOString(), job });
  writeQueue(jobs);
  return true;
};

const dequeueJob = () => {
  const jobs = readQueue();
  if (!jobs.length) return null;
  const item = jobs.shift();
  writeQueue(jobs);
  return item;
};

module.exports = { enqueueJob, dequeueJob };
