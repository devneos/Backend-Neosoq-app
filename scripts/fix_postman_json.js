const fs = require('fs');
const p = '/Users/brightlazarus/Documents/Github/Backend-Neosoq-app/postman/marketplace_api_collection.json';
let s = fs.readFileSync(p, 'utf8');
let out = '';
let inStr = false;
let esc = false;
for (let i = 0; i < s.length; i++) {
  const ch = s[i];
  if (inStr) {
    if (esc) {
      out += ch;
      esc = false;
    } else if (ch === '\\') {
      out += ch;
      esc = true;
    } else if (ch === '\n' || ch === '\r') {
      out += '\\n'; // escape literal newlines inside strings
    } else if (ch === '"') {
      inStr = false;
      out += ch;
    } else {
      out += ch;
    }
  } else {
    if (ch === '"') {
      inStr = true;
      out += ch;
    } else {
      out += ch;
    }
  }
}
fs.writeFileSync(p, out, 'utf8');
try {
  JSON.parse(fs.readFileSync(p, 'utf8'));
  console.log('Fixed and JSON OK');
} catch (e) {
  console.error('Still invalid JSON:', e.message);
  process.exit(1);
}
