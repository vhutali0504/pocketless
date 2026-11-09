// Fails when the app shell JS (every dist/assets/*.js except the lazily loaded ZXing scanner)
// is over 150 KB gzipped. Run after `npm run build`.
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { gzipSync } from 'node:zlib';

const LIMIT = 150 * 1024;
const assets = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'dist', 'assets');

let names;
try {
  names = (await readdir(assets)).filter((n) => n.endsWith('.js')).sort();
} catch {
  console.error('dist/assets not found. Run `npm run build` first.');
  process.exit(1);
}

const kb = (n) => `${(n / 1024).toFixed(2)} KB`;
const rows = [];
let total = 0;
for (const name of names) {
  const code = await readFile(join(assets, name));
  const gz = gzipSync(code, { level: 9 }).length;
  const scanner = name.startsWith('zxing-'); // named by manualChunks in vite.config.js
  if (!scanner) total += gz;
  rows.push({ file: name, raw: kb(code.length), gzip: kb(gz), counted: scanner ? 'no (scanner, lazy)' : 'yes' });
}

console.table(rows);
console.log(`App shell JS: ${kb(total)} gzipped (limit ${kb(LIMIT)})`);
if (total > LIMIT) {
  console.error('FAIL: app shell JS is over the budget.');
  process.exit(1);
}
console.log('PASS');
