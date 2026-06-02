import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { cleanGloss } from './build-search-index.mjs';

// Canonical set of ACTUAL lpCategory labels (decoded form). The issue #3 prose
// names differ for four of these (edible item, supernatural, hunting & gathering,
// insect & invertebrate) — these are the real labels found in lexicon/*.htm.
export const ENV_CATEGORIES = new Set([
  'bird', 'boat related', 'direction', 'edible fruit', 'edible item',
  'fire', 'fish', 'flora', 'hunting & gathering', 'marine', 'medicine',
  'natural environment', 'navigation', 'place', 'reptile', 'season',
  'space', 'supernatural', 'insect & invertebrate',
]);

export function isEnvironmental(rawCategory) {
  return ENV_CATEGORIES.has(cleanGloss(rawCategory));
}

// `block` is a full <p class="lpLexEntryPara">…</p> string.
export function tagBlock(block) {
  if (block.includes('class="lpEnvLex"')) return block; // idempotent
  const m = block.match(/<span class="lpCategory">([^<]*)<\/span>/);
  if (!m || !isEnvironmental(m[1])) return block;
  const close = block.lastIndexOf('</p>');
  return block.slice(0, close) + '<span class="lpEnvLex">Environmental</span>' + block.slice(close);
}

export function tagHtml(html) {
  let count = 0;
  const out = html.replace(/<p class="lpLexEntryPara">[\s\S]*?<\/p>/g, (block) => {
    const tagged = tagBlock(block);
    if (tagged !== block) count++;
    return tagged;
  });
  return { html: out, count };
}

// ---------- CLI ----------
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const here = dirname(fileURLToPath(import.meta.url));
  const lexiconDir = join(here, '..', 'lexicon');
  const files = readdirSync(lexiconDir).filter(f => /^\d{2}\.htm$/.test(f)).sort();
  let total = 0;
  for (const file of files) {
    const path = join(lexiconDir, file);
    const html = readFileSync(path, 'utf8');
    const { html: out, count } = tagHtml(html);
    if (count > 0) {
      writeFileSync(path, out, 'utf8');
      total += count;
    }
    process.stdout.write(`${file}: tagged ${count}\n`);
  }
  process.stdout.write(`Done. Tagged ${total} environmental entries.\n`);
}
