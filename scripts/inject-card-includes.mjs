/* scripts/inject-card-includes.mjs — one-shot script that adds the
   cards.css <link> and cards.js <script> tags to every dictionary entry
   HTML file. Idempotent: re-running it skips files that already have
   the cards.css reference. */

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..');

const CSS_TAG = '<link rel="stylesheet" href="../assets/cards.css" type="text/css" />';
const JS_TAG  = '<script src="../assets/cards.js" defer></script>';
const ANCHOR_RE = /(^[ \t]*<link rel="stylesheet" href="\.\.\/stylesheets\/lexiquepro\.css"[^>]*\/>)/m;

function processDir(relDir, fileRe) {
  const absDir = join(repoRoot, relDir);
  const files = readdirSync(absDir).filter(f => fileRe.test(f));
  let modified = 0, skipped = 0;
  for (const fname of files) {
    const path = join(absDir, fname);
    const html = readFileSync(path, 'utf8');
    if (html.includes('assets/cards.css')) { skipped++; continue; }
    const match = html.match(ANCHOR_RE);
    if (!match) {
      console.warn(`SKIP ${relDir}/${fname}: lexiquepro.css <link> not found`);
      skipped++;
      continue;
    }
    const indent = match[1].match(/^[ \t]*/)[0];
    const insertion = '\n' + indent + CSS_TAG + '\n' + indent + JS_TAG;
    const updated = html.replace(ANCHOR_RE, match[1] + insertion);
    writeFileSync(path, updated, 'utf8');
    modified++;
  }
  return { modified, skipped };
}

const lex = processDir('lexicon',    /^\d{2}\.htm$/);
const cat = processDir('categories', /^c\d{3}\.htm$/);
console.log(`lexicon:    ${lex.modified} modified, ${lex.skipped} skipped`);
console.log(`categories: ${cat.modified} modified, ${cat.skipped} skipped`);
