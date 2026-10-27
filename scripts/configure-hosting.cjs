const fs = require('node:fs');
const path = require('node:path');

let origin;

try {
  const url = new URL(process.argv[2]);
  if (url.protocol !== 'https:' || url.origin !== process.argv[2]) {
    throw new Error();
  }
  origin = url.origin;
} catch {
  console.error('Usage: npm run configure:hosting -- https://YOUR-API.onrender.com (origin only, no trailing slash)');
  process.exit(1);
}

const file = path.resolve(__dirname, '../vercel.json');
const config = JSON.parse(fs.readFileSync(file, 'utf8'));
const policy = config.headers[0].headers.find((header) => header.key === 'Content-Security-Policy');

policy.value = policy.value.replace(/connect-src [^;]+/, "connect-src 'self' " + origin + ' ' + origin.replace('https:', 'wss:'));

fs.writeFileSync(file, JSON.stringify(config, null, 2) + '\n');
console.log('Frontend CSP now permits REST and WebSockets only at ' + origin + '. Configure the two VITE_ variables in Vercel before deploying.');
