// Sets the app version everywhere it appears, so browsers never mix old
// and new files after an update: the home-screen label, the stylesheet
// and script URLs in index.html, and every import between modules.
//
//   node scripts/set-version.mjs 1.6

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const version = process.argv[2];
if (!/^\d+(\.\d+)*$/.test(version || '')) {
  console.error('Usage: node scripts/set-version.mjs <version>, e.g. 1.6');
  process.exit(1);
}
const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const indexPath = join(root, 'index.html');
let html = readFileSync(indexPath, 'utf8');
html = html
  .replace(/Version [\d.]+/, `Version ${version}`)
  .replace(/(css\/styles\.css|js\/app\.js)(\?v=[\d.]+)?"/g, `$1?v=${version}"`)
  .replace(/window\.APP_VERSION = '[\d.]+'/, `window.APP_VERSION = '${version}'`);
writeFileSync(indexPath, html);

const jsDir = join(root, 'js');
for (const file of readdirSync(jsDir).filter((f) => f.endsWith('.js'))) {
  const path = join(jsDir, file);
  const src = readFileSync(path, 'utf8');
  const out = src.replace(/(from\s+'\.\/[\w-]+\.js)(\?v=[\d.]+)?'/g, `$1?v=${version}'`);
  if (out !== src) writeFileSync(path, out);
}
console.log(`Version set to ${version}`);
