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

// `block` is a full <p class="lpLexEntryPara">…</p> string. An entry may carry
// several semantic-domain categories; tag it if ANY of them is environmental
// (the environmental category is not always the first one).
export function tagBlock(block) {
  if (block.includes('class="lpEnvLex"')) return block; // idempotent
  const cats = block.matchAll(/<span class="lpCategory">([^<]*)<\/span>/g);
  let isEnv = false;
  for (const m of cats) {
    if (isEnvironmental(m[1])) { isEnv = true; break; }
  }
  if (!isEnv) return block;
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
// Tags the lexicon AND the per-category copies (categories/cNNN.htm), so the
// Environmental pill + ENV filter work in the cards renderer everywhere those
// entry paragraphs are surfaced.
function tagDir(dir, re) {
  let total = 0;
  for (const file of readdirSync(dir).filter(f => re.test(f)).sort()) {
    const path = join(dir, file);
    const html = readFileSync(path, 'utf8');
    const { html: out, count } = tagHtml(html);
    if (count > 0) { writeFileSync(path, out, 'utf8'); total += count; }
  }
  return total;
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const here = dirname(fileURLToPath(import.meta.url));
  const repo = join(here, '..');
  const lex = tagDir(join(repo, 'lexicon'), /^\d{2}\.htm$/);
  const cat = tagDir(join(repo, 'categories'), /^c\d{3}\.htm$/);
  process.stdout.write(`Done. Tagged ${lex} lexicon + ${cat} category entries (idempotent).\n`);
}
