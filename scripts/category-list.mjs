import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// Map each categories/cNNN.htm to its category name, taken from the lpTitlePara
// (e.g. <p ... class="lpTitlePara">activity & event</p>). Entities are decoded.
function decode(s) {
  return s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n)).trim();
}

export function categoryList(dir) {
  const here = dirname(fileURLToPath(import.meta.url));
  const catDir = dir || join(here, '..', 'categories');
  return readdirSync(catDir)
    .filter(f => /^c\d{3}\.htm$/.test(f))
    .sort()
    .map(f => {
      const html = readFileSync(join(catDir, f), 'utf8');
      const m = html.match(/class="lpTitlePara">([^<]*)</);
      return { file: f, name: m ? decode(m[1]) : '' };
    });
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const here = dirname(fileURLToPath(import.meta.url));
  const out = join(here, '..', 'assets', 'category-list.json');
  const list = categoryList();
  writeFileSync(out, JSON.stringify(list), 'utf8');
  process.stdout.write(`Wrote ${list.length} categories to ${out}\n`);
}
