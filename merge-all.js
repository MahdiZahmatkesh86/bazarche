// merge-all.js
// همه کدهای پروژه را در یک فایل متنی (all_code.txt) ادغام می‌کند.
// اجرا: node merge-all.js

const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const OUTPUT = 'all_code.txt';

const SKIP_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', 'uploads',
  'coverage', '.next', '.vscode', '.idea', 'logs'
]);
const SKIP_FILES = new Set([
  'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml',
  OUTPUT, 'merge-all.js', 'merge.js'
]);
const EXTS = new Set([
  '.js', '.mjs', '.cjs', '.json', '.html', '.htm', '.css',
  '.sql', '.md', '.ejs', '.pug', '.hbs', '.txt'
]);

const MAX_FILE_BYTES = 200 * 1024; // فایل‌های بزرگ‌تر از 200KB رد می‌شن

// پنهان کردن خودکار مقادیر حساس (رمز، کلید و ...)
const REDACT = true;
const SECRET_RE =
  /((?:password|passwd|pwd|secret|token|api[_-]?key|apikey|private[_-]?key|auth)\w*\s*[:=]\s*)(['"`])(.*?)\2/gi;

function redact(text) {
  return text.replace(SECRET_RE, (m, prefix, quote) => `${prefix}${quote}***REDACTED***${quote}`);
}

const files = [];
const skipped = [];

function walk(dir) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (e) {
    return;
  }
  entries.sort((a, b) => a.name.localeCompare(b.name));
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) walk(full);
      continue;
    }
    const rel = path.relative(ROOT, full);
    if (SKIP_FILES.has(entry.name) || entry.name.startsWith('.env')) continue;
    if (!EXTS.has(path.extname(entry.name).toLowerCase())) continue;
    const size = fs.statSync(full).size;
    if (size > MAX_FILE_BYTES) {
      skipped.push(`${rel} (${Math.round(size / 1024)}KB)`);
      continue;
    }
    files.push(rel);
  }
}

walk(ROOT);

let out = '';
out += `PROJECT: ${path.basename(ROOT)}\n`;
out += `FILES: ${files.length}\n\n`;
out += '===== PROJECT STRUCTURE =====\n';
out += files.map(f => '- ' + f.split(path.sep).join('/')).join('\n') + '\n';

for (const rel of files) {
  let content = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  if (REDACT) content = redact(content);
  out += `\n\n===== FILE: ${rel.split(path.sep).join('/')} =====\n`;
  out += content;
}

fs.writeFileSync(path.join(ROOT, OUTPUT), out);

const kb = Math.round(Buffer.byteLength(out) / 1024);
console.log(`Done: ${files.length} file(s) merged into ${OUTPUT} (${kb}KB)`);
if (skipped.length) {
  console.log('Skipped (too large):');
  skipped.forEach(s => console.log('  - ' + s));
}
