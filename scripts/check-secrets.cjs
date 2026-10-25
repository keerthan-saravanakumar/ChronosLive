const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
const findings = new Set();
const patterns = [
  ['private key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ['GitHub credential', /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,})\b/],
  ['Google API credential', /\bAIza[A-Za-z0-9_-]{35}\b/],
  ['JWT literal', /\beyJ[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{20,}\b/],
  ['connection credential', /(?:mongodb(?:\+srv)?|cloudinary):\/\/[^\s<>:@]+:[^\s<>@]+@/],
];
const forbidden = file => /(^|\/)(?:\.env(?:\.[^/]+)?|\.local\/[^/]+|.*\.pem)$/.test(file) && !file.endsWith('.env.example');
const textual = file => /\.(?:[cm]?jsx?|json|ya?ml|md|css|html|example)$/.test(file) || /(^|\/)\.env/.test(file);
function inspect(label, content) {
  for (const [kind, pattern] of patterns) if (pattern.test(content)) findings.add(label + ': ' + kind);
  const assignments = content.matchAll(/^[ \t]*(?:JWT_SECRET|CLOUDINARY_API_SECRET|GEMINI_API_KEY|DEMO_PASSWORD|VERCEL_TOKEN|RENDER_API_KEY|GITHUB_TOKEN|GH_TOKEN)[ \t]*=[ \t]*(\S+)/gm);
  for (const match of assignments) if (!/^(?:replace|your-|<|\$|#|"?"?$)/i.test(match[1])) findings.add(label + ': non-placeholder credential assignment');
}

// Inspect each distinct historical text blob, not only the latest checkout. Never print values.
const objects = git(['rev-list', '--objects', '--all']).trim().split('\n');
let checked = 0;
for (const line of objects) {
  const split = line.indexOf(' ');
  if (split < 0) continue;
  const oid = line.slice(0, split), file = line.slice(split + 1).trim();
  if (forbidden(file)) findings.add('history ' + file + ': forbidden credential file');
  if (!textual(file)) continue;
  const content = git(['cat-file', 'blob', oid]);
  inspect('history ' + file + ' (' + oid.slice(0, 8) + ')', content);
  checked++;
}
for (const file of git(['ls-files', '-z', '--cached', '--others', '--exclude-standard']).split('\0').filter(Boolean)) {
  if (forbidden(file)) findings.add('working tree ' + file + ': forbidden credential file');
  if (textual(file) && fs.existsSync(path.join(root, file))) inspect('working tree ' + file, fs.readFileSync(path.join(root, file), 'utf8'));
}
if (findings.size) {
  console.error([...findings].join('\n'));
  process.exitCode = 1;
} else console.log('Credential-pattern scan passed: ' + checked + ' historical text blobs and the non-ignored working tree.');
