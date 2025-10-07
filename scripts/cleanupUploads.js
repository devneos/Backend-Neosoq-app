const fs = require('fs');
const path = require('path');

const uploadDir = path.join(__dirname, '..', 'uploads', 'listings');
const AGE_MINUTES = Number(process.env.CLEANUP_AGE_MINUTES) || 30;

const main = async () => {
  if (!fs.existsSync(uploadDir)) {
    console.log('Upload dir does not exist, nothing to clean');
    return;
  }
  const files = fs.readdirSync(uploadDir);
  const now = Date.now();
  let removed = 0;
  for (const f of files) {
    const p = path.join(uploadDir, f);
    try {
      const stat = fs.statSync(p);
      const ageMinutes = (now - stat.mtimeMs) / 1000 / 60;
      if (ageMinutes > AGE_MINUTES) {
        fs.unlinkSync(p);
        removed++;
      }
    } catch (e) {
      console.error('Failed to remove', p, e);
    }
  }
  console.log(`Cleanup complete, removed ${removed} files`);
};

main().catch(e => { console.error(e); process.exit(1); });
