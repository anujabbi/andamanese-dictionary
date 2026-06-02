import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// Inject the shared chrome (chrome.css + GA_PAGE + chrome.js) into a level-2
// content page, just before </head>. Idempotent: a page that already loads
// chrome.js is returned unchanged.
export function addChrome(html, opts) {
  if (html.includes('assets/chrome.js')) return html;
  const css = `<link rel="stylesheet" href="${opts.base}assets/chrome.css" type="text/css" />`;
  const js = `<script>window.GA_PAGE={section:'${opts.section}',base:'${opts.base}'};</script>`
           + `<script src="${opts.base}assets/chrome.js" defer></script>`;
  return html.replace(/<\/head>/i, '  ' + css + '\n ' + js + '\n</head>');
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  // usage: node scripts/add-chrome.mjs <dir> <section> <base> [filePattern]
  const [dir, section, base, pat] = process.argv.slice(2);
  const re = new RegExp(pat || '^\\d{2}\\.htm$');
  const here = dirname(fileURLToPath(import.meta.url));
  const abs = join(here, '..', dir);
  let n = 0;
  for (const f of readdirSync(abs).filter(f => re.test(f))) {
    const p = join(abs, f);
    const cur = readFileSync(p, 'utf8');
    const out = addChrome(cur, { section, base });
    if (out !== cur) { writeFileSync(p, out, 'utf8'); n++; }
  }
  process.stdout.write(`add-chrome: updated ${n} files in ${dir}\n`);
}
