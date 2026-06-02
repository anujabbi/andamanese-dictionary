import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// Explicit collation orders (no reliable locale collation under file://).
// Derived from the curated alphalinks letter sequences. The leading "-" prefix
// group used by the Devanagari index is handled by its existing per-letter
// files; for the alternate GA-Devanagari sort we skip leading hyphens and group
// by the first real letter, so "-" is intentionally NOT in DEV_GA_ORDER.
export const DEV_GA_ORDER = [
  'आ', 'ई', 'ऊ', 'ए', 'ऐ', 'ओ', 'औ', 'क', 'ख', 'ग', 'ङ', 'च', 'छ', 'ज', 'ञ',
  'ट', 'ठ', 'ड', 'त', 'थ', 'द', 'न', 'प', 'फ', 'ब', 'म', 'य', 'र', 'ल', 'व', 'श', 'स', 'ह',
];
export const HINDI_ORDER = [
  'अ', 'आ', 'इ', 'ई', 'उ', 'ऊ', 'ए', 'ऐ', 'ओ', 'औ', 'क', 'ख', 'ग', 'घ', 'च', 'छ', 'ज', 'झ',
  'ट', 'ठ', 'ड', 'ढ', 'त', 'थ', 'द', 'ध', 'न', 'प', 'फ', 'ब', 'भ', 'म', 'य', 'र', 'ल', 'व', 'श', 'स', 'ह',
];

// First character of `text` that is a member of `order` (skips leading hyphens,
// spaces, avagraha, etc.).
export function firstLetter(text, order) {
  const set = new Set(order);
  for (const ch of String(text || '')) {
    if (set.has(ch)) return ch;
  }
  return '';
}

// Stable sort of `items` by their key's first letter (per `order`), then lexicographically.
export function sortByOrder(items, keyFn, order) {
  const idx = new Map(order.map((c, i) => [c, i]));
  const rank = s => {
    const fl = firstLetter(keyFn(s), order);
    return idx.has(fl) ? idx.get(fl) : order.length;
  };
  return items.slice().sort((a, b) => {
    const ra = rank(a), rb = rank(b);
    if (ra !== rb) return ra - rb;
    return String(keyFn(a)).localeCompare(String(keyFn(b)));
  });
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const here = dirname(fileURLToPath(import.meta.url));
  const out = join(here, '..', 'assets', 'collation-data.json');
  writeFileSync(out, JSON.stringify({ devGa: DEV_GA_ORDER, hindi: HINDI_ORDER }), 'utf8');
  process.stdout.write(`Wrote collation orders to ${out}\n`);
}
