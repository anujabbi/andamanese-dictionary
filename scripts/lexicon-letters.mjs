import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// Derive the per-page IPA letter label from each lexicon/NN.htm's lpTitlePara,
// which looks like:  <p align="center" class="lpTitlePara">Ɑ  -  ɑ</p>
// The lowercase letter (after the dash) is the label used in the letter row.
export function lexiconLetters(dir) {
  const here = dirname(fileURLToPath(import.meta.url));
  const lexDir = dir || join(here, '..', 'lexicon');
  return readdirSync(lexDir)
    .filter(f => /^\d{2}\.htm$/.test(f))
    .sort()
    .map(f => {
      const html = readFileSync(join(lexDir, f), 'utf8');
      const m = html.match(/class="lpTitlePara">([^<]*)</);
      let label = '';
      if (m) {
        const parts = m[1].split('-');
        label = (parts[parts.length - 1] || '').trim();
      }
      return { file: f, label };
    });
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const here = dirname(fileURLToPath(import.meta.url));
  const out = join(here, '..', 'assets', 'lexicon-letters.json');
  const map = lexiconLetters();
  writeFileSync(out, JSON.stringify(map), 'utf8');
  process.stdout.write(`Wrote ${map.length} lexicon letters to ${out}\n`);
}
