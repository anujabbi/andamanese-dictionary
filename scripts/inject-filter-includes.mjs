/* scripts/inject-filter-includes.mjs — add the cards.css link and the
   filter.js script tag to every reverse-index pane (the NN.htm files under
   index-english, index-hindi, index-ga_in_sript).
   Idempotent: skips files that already reference assets/filter.js.
   Modeled on scripts/inject-card-includes.mjs. */

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..');

const CSS_TAG = '<link rel="stylesheet" href="../assets/cards.css" type="text/css" />';
const JS_TAG  = '<script src="../assets/filter.js" defer></script>';
const ANCHOR_RE = /(^[ \t]*<link rel="stylesheet" href="\.\.\/stylesheets\/lexiquepro\.css"[^>]*\/>)/m;

const DIRS = ['index-english', 'index-hindi', 'index-ga_in_sript'];
const FILE_RE = /^\d{2}\.htm$/;

let totalMod = 0, totalSkip = 0;
for (const relDir of DIRS) {
  const absDir = join(repoRoot, relDir);
  const files = readdirSync(absDir).filter(f => FILE_RE.test(f));
  let modified = 0, skipped = 0;
  for (const fname of files) {
    const path = join(absDir, fname);
    const html = readFileSync(path, 'utf8');
    if (html.includes('assets/filter.js')) { skipped++; continue; }
    const match = html.match(ANCHOR_RE);
    if (!match) { console.warn(`SKIP ${relDir}/${fname}: lexiquepro.css link not found`); skipped++; continue; }
    const indent = match[1].match(/^[ \t]*/)[0];
    const insertion = '\n' + indent + CSS_TAG + '\n' + indent + JS_TAG;
    writeFileSync(path, html.replace(ANCHOR_RE, match[1] + insertion), 'utf8');
    modified++;
  }
  console.log(`${relDir}: ${modified} modified, ${skipped} skipped`);
  totalMod += modified; totalSkip += skipped;
}
console.log(`TOTAL: ${totalMod} modified, ${totalSkip} skipped`);
