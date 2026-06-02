# Level-2 Pages Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Lexique-Pro HTML framesets on every level-2 page (lexicon, three reverse indexes, categories) with modern, responsive, single-document pages that share one injected header, a top letter row with an `[a–z | देव]` script toggle, a two-pane in-place index/entry experience, and the existing Show filter.

**Architecture:** A shared `assets/chrome.js`/`chrome.css` injects the header + letter row + filter on every level-2 page (replacing `title.htm`). `assets/cards.js` is refactored to expose `parseEntry`/`renderCard` so a new `assets/browse.js` can render entries fetched from other files into the right pane of the two-pane index/category pages. Letter ordering and the GA-Devanagari alternate sort are driven by `assets/search-index.json`. Framesets, the Treeview, and `index-go.js` are removed.

**Tech Stack:** Plain HTML/CSS/vanilla JS (no build, no modules, globally-scoped IIFEs); zero-dependency Node ESM scripts tested with `node:test`; Playwright (served over `http://localhost:PORT`) for DOM/visual verification.

**Spec:** `docs/superpowers/specs/2026-06-02-level2-pages-redesign-design.md`
**Design mockups (source of truth for markup/CSS, not committed):** `mockups/` — `option-b.htm` (lexicon), `option-2bar-toggle.htm` (index with script toggle), `option-category.htm` (categories), `_shared.css` (header/letter row/scope/cards/two-pane styles).

---

## Conventions for this plan

- **Serve for verification:** `python -m http.server 8800` from the repo root; verify against
  `http://localhost:8800/...`. Use a fresh port and a `?cb=N` query when the browser cache or
  bfcache interferes (known issue in this environment).
- **Node tests:** run with `node --test scripts/tests/<file>.test.mjs` (the bare-directory form
  `node --test scripts/tests/` is misparsed on this Windows/Node setup — always name files).
- **Scripted file edits:** pages are generated and numerous; edits that touch many files (adding
  `chrome.js`, removing frame-only markup) are done with committed, idempotent Node scripts under
  `scripts/`, never hand edits — mirroring `scripts/tag-environmental.mjs`.
- Phases are ordered so each leaves the site working. Commit after every task.

---

## File Structure

**New:**
- `assets/chrome.css` — header, letter row + script toggle, scope control styles (ported from `mockups/_shared.css`).
- `assets/chrome.js` — injects header + letter row + scope filter on every level-2 page; per-page config; writes `ga.filter`/`ga.filter.value`; defines script collations.
- `assets/browse.js` — two-pane controller for reverse-index & category pages (left list, in-place entry/card rendering, script-toggle ordering).
- `scripts/collation.mjs` — pure ordering helpers (IPA/Latin/Hindi/GA-Devanagari) + tests, importable by both Node tests and (copied constants) the browser. 
- `scripts/add-chrome.mjs` — idempotent migration: inject the `chrome.js`/`chrome.css` includes into level-2 content pages.
- `scripts/tests/collation.test.mjs`, `scripts/tests/add-chrome.test.mjs`.

**Modified:**
- `assets/cards.js` — expose `window.GACards = { parseEntry, renderCard }`; otherwise unchanged behavior.
- `assets/filter.js` — add the `env` case.
- `lexicon/index.htm` — frameset → redirect/landing on first letter.
- `lexicon/NN.htm` (×35) — add chrome includes (scripted).
- `index-english|hindi|ga_in_sript/index.htm` — frameset → two-pane page.
- `index-*/NN.htm` (term lists) — keep as data source for the left list (loaded by `browse.js`); add nothing.
- `categories/index.htm` — frameset → two-pane page.
- `categories/cNNN.htm` (×124) — already load `cards.js`; add chrome includes (scripted) only if browsed standalone (optional).

**Removed (final phase):**
- `title.htm`; all five `*/index.htm` framesets are replaced (not deleted — repurposed).
- `categories/tree.htm`, `javascript/ftiens4.js`, `javascript/categoryNodes.js`, `javascript/ua.js`.
- `javascript/index-go.js`.
- `index-*/alphalinks.htm` (letters move into the header letter row).

---

## Phase 0 — Shared chrome (header + filter)

Outcome: a header that injects on any page and wires the Show filter. No letter row yet.

### Task 0.1: chrome.css from the mockup

**Files:**
- Create: `assets/chrome.css`

- [ ] **Step 1: Port the styles.** Copy the header, `.scope`, `.letterbar`/`.scriptseg`, two-pane
  (`.layout`/`.idx`/`.ilist`/`.pane`), and `.catlist` rules from `mockups/_shared.css` into
  `assets/chrome.css` verbatim (they are already the approved look). Do NOT copy the `:root`
  variables or `.entry`/`.cards` rules — those already live in `cards.css`/`lexiquepro.css`.
  Prefix the injected header wrapper with a root class `.ga-chrome` on the elements chrome.js
  creates, but keep the inner class names (`.hdr`, `.letterbar`, `.scope`, …) as in the mockup so
  the markup matches.

- [ ] **Step 2: Verify** the file parses (no syntax errors): `node -e "require('fs').readFileSync('assets/chrome.css','utf8')"` (exists/readable). Visual check happens in 0.3.

- [ ] **Step 3: Commit**

```bash
git add assets/chrome.css
git commit -m "feat: chrome.css — shared header/letter-row/two-pane styles (level-2 redesign)"
```

### Task 0.2: chrome.js — inject header + wire filter

**Files:**
- Create: `assets/chrome.js`

- [ ] **Step 1: Write `chrome.js`.** An IIFE that, on DOMContentLoaded, reads a page config from a
  global `window.GA_PAGE` (set by each page: `{ section: 'lexicon'|'english'|'hindi'|'devanagari'|'categories', base: '../' }`),
  injects the header markup from `mockups/option-b.htm` (the `<header class="hdr">…</header>`),
  sets the active nav link from `section`, and wires the scope `<select>`s to
  `sessionStorage` keys `ga.filter`/`ga.filter.value`. On change it persists and dispatches a
  `document` event `ga:filterchange`. Restore the selects from sessionStorage on load. The ETYM
  source select is hidden unless main === 'etym'. Use the nav hrefs from `GA_PAGE.base` so it works
  at any directory depth. Full structure:

```js
/* assets/chrome.js — injects the shared level-2 header + scope filter.
   Pages set window.GA_PAGE = { section, base } before this loads. No modules. */
(function () {
  'use strict';
  var CFG = window.GA_PAGE || { section: '', base: '' };
  var B = CFG.base || '';

  var NAV = [
    ['lexicon',    'Lexicon',    B + 'lexicon/index.htm'],
    ['devanagari', 'Devanagari', B + 'index-ga_in_sript/index.htm'],
    ['english',    'English',    B + 'index-english/index.htm'],
    ['hindi',      'Hindi',      B + 'index-hindi/index.htm'],
    ['categories', 'Categories', B + 'categories/index.htm'],
  ];

  function el(tag, cls, txt) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt != null) e.textContent = txt;
    return e;
  }

  function buildHeader() {
    var hdr = el('header', 'hdr ga-chrome');
    var brand = el('a', 'brand'); brand.href = B + 'index.htm';
    brand.innerHTML = 'Great <b>Andamanese</b>';
    hdr.appendChild(brand);
    var nav = el('nav');
    NAV.forEach(function (n) {
      var a = el('a', n[0] === CFG.section ? 'active' : '', n[1]);
      a.href = n[2];
      nav.appendChild(a);
    });
    hdr.appendChild(nav);
    hdr.appendChild(el('span', 'spacer'));
    hdr.appendChild(buildScope());
    return hdr;
  }

  function opt(value, label, sel) {
    var o = document.createElement('option');
    o.value = value; o.textContent = label; if (sel) o.selected = true;
    return o;
  }

  var mainSel, srcSel;
  function buildScope() {
    var wrap = el('span', 'scope');
    wrap.appendChild(el('label', null, 'Show'));
    mainSel = el('select', 'scope-main');
    [['', 'All entries'], ['etym', 'ETYM'], ['morph', 'MORPH'], ['env', 'ENV']]
      .forEach(function (p) { mainSel.appendChild(opt(p[0], p[1])); });
    srcSel = el('select', 'scope-src');
    wrap.appendChild(mainSel); wrap.appendChild(srcSel);
    return wrap;
  }

  function readLS(k) { try { return sessionStorage.getItem(k) || ''; } catch (e) { return ''; } }
  function writeLS(k, v) { try { sessionStorage.setItem(k, v); } catch (e) {} }

  function syncSrcVisibility() { srcSel.hidden = mainSel.value !== 'etym'; }

  function restore() {
    var f = readLS('ga.filter');
    if (f === 'etym' || f === 'morph' || f === 'env') mainSel.value = f;
    syncSrcVisibility();
    // Source options are populated by the page (it knows the index); default just "All sources".
    if (!srcSel.options.length) srcSel.appendChild(opt('', 'All sources'));
    srcSel.value = readLS('ga.filter.value');
  }

  function onChange() {
    writeLS('ga.filter', mainSel.value);
    if (mainSel.value !== 'etym') { writeLS('ga.filter.value', ''); srcSel.value = ''; }
    else writeLS('ga.filter.value', srcSel.value || '');
    syncSrcVisibility();
    document.dispatchEvent(new CustomEvent('ga:filterchange'));
  }

  function init() {
    document.body.insertBefore(buildHeader(), document.body.firstChild);
    restore();
    mainSel.addEventListener('change', onChange);
    srcSel.addEventListener('change', onChange);
  }

  // Expose a hook so pages can add their letter row / populate source options.
  window.GAChrome = {
    onReady: function (fn) { document.addEventListener('ga:chromeready', fn); },
    headerEl: function () { return document.querySelector('header.ga-chrome'); },
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
  function start() { init(); document.dispatchEvent(new CustomEvent('ga:chromeready')); }
})();
```

- [ ] **Step 2: Commit**

```bash
git add assets/chrome.js
git commit -m "feat: chrome.js — inject shared header + wire Show filter"
```

### Task 0.3: Prove chrome on a throwaway harness page

**Files:**
- Create (temporary): `mockups/_probe.htm`

- [ ] **Step 1:** Create a minimal page that loads `../stylesheets/lexiquepro.css`,
  `../assets/cards.css`, `../assets/chrome.css`, sets `window.GA_PAGE = { section:'lexicon', base:'../' }`,
  loads `../assets/chrome.js`, and has an empty `<body>`. (Put it under `mockups/` so relative
  `../` resolves to repo root like a real `lexicon/` page would — actually use `base:''` and put it
  at repo root as `_probe.htm`; delete after.)

- [ ] **Step 2: Verify with Playwright** (server on a fresh port): header renders, the "Lexicon"
  nav link has class `active`, changing the Show select to ETYM reveals the source select and sets
  `sessionStorage['ga.filter']==='etym'`. Evaluate in-page to assert.
  Expected: `{ headerPresent:true, active:'Lexicon', srcHiddenForAll:true, srcShownForEtym:true, ls:'etym' }`.

- [ ] **Step 3:** Delete the probe page. **Commit** nothing (probe is throwaway) — or commit only if
  you kept a permanent example (don't).

---

## Phase 1 — Lexicon (IPA mode, frameless)

Outcome: `lexicon/` works frameless with the modern header + top IPA letter row + cards.

### Task 1.1: Letter-row module in chrome.js (IPA mode only)

**Files:**
- Modify: `assets/chrome.js`

- [ ] **Step 1:** Add a `GAChrome.renderLetterRow(opts)` function that builds
  `<nav class="letterbar">` (+ optional `.scriptseg` toggle) under the header. For Phase 1, pages
  call it with a single script: `GAChrome.renderLetterRow({ letters: [{label,href|key,active}], toggle:null })`.
  Each letter is an `<a>` (href for page-nav mode, or data-key for in-place mode). Insert the row
  immediately after the header. Show the active letter with class `active`.

```js
window.GAChrome.renderLetterRow = function (opts) {
  var bar = document.createElement('nav');
  bar.className = 'letterbar' + (opts.toggle ? ' labeled' : '');
  if (opts.toggle) bar.appendChild(opts.toggle); // a .scriptseg element built by the page
  (opts.letters || []).forEach(function (L) {
    var a = document.createElement('a');
    a.textContent = L.label;
    if (L.href) a.href = L.href;
    if (L.key) a.dataset.key = L.key;
    if (L.active) a.className = 'active';
    bar.appendChild(a);
  });
  var hdr = document.querySelector('header.ga-chrome');
  hdr.parentNode.insertBefore(bar, hdr.nextSibling);
  return bar;
};
```

- [ ] **Step 2: Commit**

```bash
git add assets/chrome.js
git commit -m "feat: chrome.js renderLetterRow (IPA/page-nav mode)"
```

### Task 1.2: Lexicon letter map (IPA letters → NN.htm)

**Files:**
- Create: `scripts/lexicon-letters.mjs` (exported constant + a generator)
- Test: `scripts/tests/lexicon-letters.test.mjs`

- [ ] **Step 1: Write the failing test** asserting the map has 35 entries and `01` → `ɑ`, `35` →
  the last letter, derived from each `lexicon/NN.htm`'s `lpTitlePara`.

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lexiconLetters } from '../lexicon-letters.mjs';

test('lexiconLetters covers every lexicon page with its IPA letter label', () => {
  const map = lexiconLetters();
  assert.equal(map.length, 35);
  assert.equal(map[0].file, '01.htm');
  assert.ok(map[0].label && map[0].label.length <= 3);
  assert.ok(map.every(m => /^\d{2}\.htm$/.test(m.file) && m.label));
});
```

- [ ] **Step 2: Run** `node --test scripts/tests/lexicon-letters.test.mjs` → FAIL (module missing).

- [ ] **Step 3: Implement** `lexicon-letters.mjs`: read each `lexicon/NN.htm`, extract the
  `<p ... class="lpTitlePara">Ɑ  -  ɑ</p>` text, take the lowercase IPA letter (after the dash),
  return `[{file:'01.htm', label:'ɑ'}, …]`.

```js
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

export function lexiconLetters(dir) {
  const here = dirname(fileURLToPath(import.meta.url));
  const lexDir = dir || join(here, '..', 'lexicon');
  return readdirSync(lexDir).filter(f => /^\d{2}\.htm$/.test(f)).sort().map(f => {
    const html = readFileSync(join(lexDir, f), 'utf8');
    const m = html.match(/class="lpTitlePara">([^<]*)</);
    let label = '';
    if (m) { const parts = m[1].split('-'); label = (parts[parts.length - 1] || '').trim(); }
    return { file: f, label };
  });
}
```

- [ ] **Step 4: Run** the test → PASS.

- [ ] **Step 5: Generate a browser constant.** Add a CLI block to `lexicon-letters.mjs` that writes
  `assets/lexicon-letters.json` (`[{file,label}]`). Run `node scripts/lexicon-letters.mjs`.
  Expected: `assets/lexicon-letters.json` written with 35 entries.

- [ ] **Step 6: Commit**

```bash
git add scripts/lexicon-letters.mjs scripts/tests/lexicon-letters.test.mjs assets/lexicon-letters.json
git commit -m "feat: derive lexicon IPA letter map for the letter row"
```

### Task 1.3: Wire the lexicon pages — chrome + letter row, scripted include injection

**Files:**
- Create: `scripts/add-chrome.mjs`
- Test: `scripts/tests/add-chrome.test.mjs`
- Modify (via script): `lexicon/NN.htm` (×35)

- [ ] **Step 1: Write the failing test** for the pure injector `addChrome(html, {section, base})`:
  it inserts the `chrome.css` link, the `GA_PAGE` script, and the `chrome.js` script once
  (idempotent), and does not duplicate on a second pass.

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addChrome } from '../add-chrome.mjs';

const PAGE = '<html><head>\n<link rel="stylesheet" href="../assets/cards.css" />\n<script src="../assets/cards.js" defer></script>\n</head><body><p class="lpLexEntryPara">x</p></body></html>';

test('addChrome injects chrome includes exactly once', () => {
  const once = addChrome(PAGE, { section: 'lexicon', base: '../' });
  assert.ok(once.includes('assets/chrome.css'));
  assert.ok(once.includes('assets/chrome.js'));
  assert.ok(once.includes("section: 'lexicon'"));
  const twice = addChrome(once, { section: 'lexicon', base: '../' });
  assert.equal(twice, once); // idempotent
});
```

- [ ] **Step 2: Run** `node --test scripts/tests/add-chrome.test.mjs` → FAIL.

- [ ] **Step 3: Implement** `addChrome` + a CLI that applies it to a directory glob.

```js
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

export function addChrome(html, opts) {
  if (html.includes('assets/chrome.js')) return html; // idempotent
  const css = `<link rel="stylesheet" href="${opts.base}assets/chrome.css" type="text/css" />`;
  const js = `<script>window.GA_PAGE={section:'${opts.section}',base:'${opts.base}'};</script>`
           + `<script src="${opts.base}assets/chrome.js" defer></script>`;
  // Insert before </head>
  return html.replace(/<\/head>/i, '  ' + css + '\n ' + js + '\n</head>');
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  // usage: node scripts/add-chrome.mjs <dir> <section> <base>
  const [dir, section, base] = process.argv.slice(2);
  const here = dirname(fileURLToPath(import.meta.url));
  const abs = join(here, '..', dir);
  let n = 0;
  for (const f of readdirSync(abs).filter(f => /^\d{2}\.htm$/.test(f))) {
    const p = join(abs, f);
    const out = addChrome(readFileSync(p, 'utf8'), { section, base });
    if (out !== readFileSync(p, 'utf8')) { writeFileSync(p, out, 'utf8'); n++; }
  }
  process.stdout.write(`add-chrome: updated ${n} files in ${dir}\n`);
}
```

- [ ] **Step 4: Run** the test → PASS.

- [ ] **Step 5: Apply to the lexicon:** `node scripts/add-chrome.mjs lexicon lexicon ../`
  Expected: `add-chrome: updated 35 files in lexicon`.

- [ ] **Step 6: Add the letter row + GA_PAGE letter config to lexicon pages.** The pages now load
  chrome.js; add a tiny inline bootstrap that calls `renderLetterRow` with the IPA letters from
  `assets/lexicon-letters.json`, marking the current page active. Implement this inside `chrome.js`
  (not per page): when `GA_PAGE.section==='lexicon'`, on `ga:chromeready`, fetch
  `lexicon-letters.json` and render the row with `href = base+'lexicon/'+file`, active = current
  file. Add that block to chrome.js. (No per-page edits beyond Step 5.)

- [ ] **Step 7: Convert the lexicon frameset.** Replace `lexicon/index.htm` contents with a redirect
  to the first letter page:

```html
<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">
<meta http-equiv="refresh" content="0; url=01.htm"><title>GA — Lexicon</title>
<link rel="canonical" href="01.htm"></head>
<body><p>Loading the lexicon… <a href="01.htm">open the lexicon</a>.</p></body></html>
```

- [ ] **Step 8: Verify with Playwright** (`http://localhost:8800/lexicon/01.htm`): header present,
  IPA letter row present with `ɑ` active, cards render (`article.entry` count > 0), audio button
  exists. Clicking letter `b` navigates to `lexicon/03.htm` (the `b` file). `lexicon/index.htm`
  redirects to `01.htm`.

- [ ] **Step 9: Commit**

```bash
git add scripts/add-chrome.mjs scripts/tests/add-chrome.test.mjs lexicon/ assets/chrome.js
git commit -m "feat: lexicon frameless — chrome header + IPA letter row (level-2 redesign)"
```

---

## Phase 2 — Reuse the card renderer

### Task 2.1: Expose parseEntry/renderCard from cards.js

**Files:**
- Modify: `assets/cards.js`

- [ ] **Step 1:** At the end of the `cards.js` IIFE, before the bootstrap, expose the existing
  functions without changing them:

```js
  window.GACards = { parseEntry: parseEntry, renderCard: renderCard, applyFilter: applyFilter };
```

- [ ] **Step 2: Verify with Playwright** on `lexicon/01.htm`: `typeof window.GACards.parseEntry`
  === 'function' and rendering still works (cards present). No behavior change.

- [ ] **Step 3: Commit**

```bash
git add assets/cards.js
git commit -m "refactor: expose GACards.parseEntry/renderCard for reuse"
```

### Task 2.2: In-place entry loader (browse.js core)

**Files:**
- Create: `assets/browse.js`

- [ ] **Step 1:** Implement `loadEntry(base, file, id)`: fetch `base+'lexicon/'+file`, parse with
  `DOMParser`, find `#id` (an `lpLexEntryName` span), walk up to its `p.lpLexEntryPara`, call
  `GACards.parseEntry(p)` then `GACards.renderCard(entry)`, and return the card element. Expose
  `window.GABrowse = { loadEntry, … }`.

```js
/* assets/browse.js — two-pane controller for reverse-index & category pages. No modules. */
(function () {
  'use strict';
  function loadEntry(base, file, id) {
    return fetch(base + 'lexicon/' + file).then(function (r) { return r.text(); }).then(function (html) {
      var doc = new DOMParser().parseFromString(html, 'text/html');
      var span = doc.getElementById(id);
      if (!span) return null;
      var p = span.closest('p.lpLexEntryPara');
      if (!p) return null;
      return window.GACards.renderCard(window.GACards.parseEntry(p));
    });
  }
  window.GABrowse = { loadEntry: loadEntry };
})();
```

- [ ] **Step 2: Verify with Playwright** on a temporary harness page that loads cards.js + browse.js
  and calls `GABrowse.loadEntry('../','01.htm','e6')`; assert the returned node is `article.entry`
  with the right IPA text. (Use an existing tagged entry e.g. e6.) Delete harness after.

- [ ] **Step 3: Commit**

```bash
git add assets/browse.js
git commit -m "feat: browse.js loadEntry — render a fetched lexicon entry as a card"
```

---

## Phase 3 — Reverse indexes (two-pane, frameless)

### Task 3.1: filter.js — add the env case

**Files:**
- Modify: `assets/filter.js:11` and `:32-36` and the empty-state message
- Test: none (browser IIFE; verified via Playwright)

- [ ] **Step 1:** In `readFilter`, accept `env`:
  `return (v === 'etym' || v === 'morph' || v === 'env') ? v : '';`

- [ ] **Step 2:** In `qualifyingIds`, add a branch: `else if (filter === 'env') { if (e.env) set.add(e.id); }`.

- [ ] **Step 3:** In the empty-state, add the env message:
  `filter === 'env' ? 'No environmental-lexicon entries on this page.' : (filter === 'etym' ? … : …)`.

- [ ] **Step 4: Verify** later in Task 3.4 (needs a working index page). For now, sanity:
  `node -e "require('fs').readFileSync('assets/filter.js','utf8').includes(\"=== 'env'\")"`.

- [ ] **Step 5: Commit**

```bash
git add assets/filter.js
git commit -m "feat: filter.js — handle the env scope on index pages"
```

### Task 3.2: Build the two-pane reverse-index shell (English first)

**Files:**
- Modify: `index-english/index.htm` (frameset → two-pane page)

- [ ] **Step 1:** Replace the frameset with a single document modeled on
  `mockups/option-index.htm`: `<head>` loads `lexiquepro.css`, `cards.css`, `chrome.css`,
  `cards.js`, `browse.js`, sets `window.GA_PAGE={section:'english',base:'../'}`, loads `chrome.js`.
  `<body>` has `<div class="layout"><aside class="idx"><div class="ttl">English → Great Andamanese</div><nav class="ilist" id="ilist"></nav></aside><div class="pane" id="pane"><div class="hint">Select a term</div></div></div>`.
  A page bootstrap (inline `<script>` or a section in `browse.js`) populates `#ilist` from the
  existing `index-english/NN.htm` tables and wires clicks. See Task 3.3 for the list logic.

- [ ] **Step 2: Commit** (page shell only)

```bash
git add index-english/index.htm
git commit -m "feat: english index — two-pane page shell (frameless)"
```

### Task 3.3: browse.js — populate list + handle clicks + letter row

**Files:**
- Modify: `assets/browse.js`

- [ ] **Step 1:** Add `initIndexPage(cfg)` to `browse.js`, called by index pages with
  `cfg = { base, letterFiles: [{label, file}], indexClass: 'lpIndexEnglish' }`. It:
  - renders the letter row via `GAChrome.renderLetterRow` (page-nav within the SPA: data-key = file),
  - loads the first (or `#`-named) letter's table by fetching `index-<sec>/NN.htm`, parsing rows
    (`tr` with `span.<indexClass>` + `a[href^="javascript:go("]`), building `#ilist` anchors
    (`<a data-file=.. data-id=.. ><span>term</span><span class="ipa">IPA</span></a>`),
  - on term click: `GABrowse.loadEntry(base, file, 'e'+id)` → replace `#pane` contents; set
    `location.hash = 'e'+id`,
  - on letter click: fetch that letter's table and repopulate `#ilist`,
  - on load, if `location.hash` matches `eNNN`, find it across the current list or load directly.

  Parse the `go('NN','ID')` href with `/go\('(\d+)',\s*'(\d+)'\)/` → file=`NN.htm`, id=`eID`.
  Expose `window.GABrowse.initIndexPage = initIndexPage`.

- [ ] **Step 2:** Wire `index-english/index.htm` to call
  `GABrowse.initIndexPage({ base:'../', section:'english', indexClass:'lpIndexEnglish', letters: <from alphalinks> })`.
  Hardcode the English letter list `[{label:'a',file:'01.htm'},…]` (24 letters) read from the
  existing `index-english/alphalinks.htm` — or have `initIndexPage` fetch `alphalinks.htm` and parse
  its `<a href="NN.htm">x</a>` links. Use the fetch-and-parse approach (DRY, no hardcode).

- [ ] **Step 3: Verify with Playwright** (`http://localhost:8800/index-english/index.htm`):
  header (English active) + top letter row (Latin a active) + left list populated;
  clicking a term renders a card in `#pane` (`article.entry` present, matching IPA);
  clicking letter `b` repopulates the list; `#e…` deep link pre-loads the entry.

- [ ] **Step 4: Commit**

```bash
git add assets/browse.js index-english/index.htm
git commit -m "feat: english index two-pane in-place loading + letter row"
```

### Task 3.4: Hindi & Devanagari index pages

**Files:**
- Modify: `index-hindi/index.htm`, `index-ga_in_sript/index.htm`

- [ ] **Step 1:** Clone the English shell for Hindi (`section:'hindi'`, `indexClass:'lpIndexHindi'`,
  title `हिन्दी → Great Andamanese`) and Devanagari (`section:'devanagari'`,
  `indexClass:'lpIndexGA_in_Sript'`, title `Browse by Devanagari spelling`). Each calls
  `GABrowse.initIndexPage` with its own `alphalinks.htm` letters.

- [ ] **Step 2: Verify with Playwright** both pages: header active state correct, letter row shows
  the right script (Hindi अ… / Devanagari आ…), list populates, term click renders the entry card.

- [ ] **Step 3: Verify the env filter end-to-end:** set `sessionStorage['ga.filter']='env'` and
  reload `index-english/index.htm` with a `?cb` buster; assert rows lacking `env` get
  `ga-filtered-out` (filter.js path) — note: filter.js targets the per-letter `tr` rows; confirm it
  still applies to the in-place list, or move the env-membership filtering into `initIndexPage`
  (preferred: filter the `#ilist` anchors by `ga:filterchange`). Implement list filtering in
  `initIndexPage` reacting to `ga:filterchange` using `search-index.json` membership; retire the
  `tr`-based path for these pages. Re-verify ENV hides non-env terms.

- [ ] **Step 4: Commit**

```bash
git add index-hindi/index.htm index-ga_in_sript/index.htm assets/browse.js
git commit -m "feat: hindi + devanagari index pages (two-pane, frameless) + env list filter"
```

---

## Phase 4 — Categories (two-pane, frameless)

### Task 4.1: Category list data

**Files:**
- Create: `scripts/category-list.mjs` (+ CLI → `assets/category-list.json`)
- Test: `scripts/tests/category-list.test.mjs`

- [ ] **Step 1: Write the failing test:** `categoryList()` returns `[{file:'c001.htm', name:'activity & event'}, …]`
  parsed from each `categories/cNNN.htm` title, length matching the number of `cNNN.htm` files.

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { categoryList } from '../category-list.mjs';
test('categoryList maps each category page to its name', () => {
  const list = categoryList();
  assert.ok(list.length >= 100);
  assert.ok(list.every(c => /^c\d{3}\.htm$/.test(c.file) && c.name));
});
```

- [ ] **Step 2: Run** → FAIL. 

- [ ] **Step 3: Implement** `category-list.mjs`: read each `categories/cNNN.htm`, extract the
  category name from its `lpTitlePara` (or `<title>`), return `[{file,name}]`; CLI writes
  `assets/category-list.json`.

- [ ] **Step 4: Run** test → PASS; run `node scripts/category-list.mjs` → writes JSON.

- [ ] **Step 5: Commit**

```bash
git add scripts/category-list.mjs scripts/tests/category-list.test.mjs assets/category-list.json
git commit -m "feat: derive category list for the categories two-pane"
```

### Task 4.2: Categories two-pane page

**Files:**
- Modify: `categories/index.htm` (frameset → two-pane)
- Modify: `assets/browse.js` (add `initCategoryPage`)

- [ ] **Step 1:** Replace `categories/index.htm` with the two-pane shell from
  `mockups/option-category.htm` (no letter row): header + `<aside class="catlist" id="catlist">` +
  `<div class="pane" id="pane">`. Loads cards.css/chrome.css/cards.js/browse.js, sets
  `GA_PAGE={section:'categories',base:'../'}`.

- [ ] **Step 2:** Add `GABrowse.initCategoryPage({base})`: fetch `assets/category-list.json`,
  render the left `#catlist` anchors; on click, fetch `categories/<file>`, extract all
  `p.lpLexEntryPara`, render each via `GACards.renderCard(GACards.parseEntry(p))` into `#pane`
  (with a `letterhead` = category name); set `location.hash = file` for deep-linking; honor
  `ga:filterchange` (hide non-matching cards using `card.dataset` like cards.js applyFilter).

- [ ] **Step 3: Verify with Playwright** (`categories/index.htm`): header (Categories active),
  category list populated; clicking "insect & invertebrate" renders its cards in `#pane` with
  Environmental pills; `#cNNN` deep link works; ENV filter hides non-env cards.

- [ ] **Step 4: Commit**

```bash
git add categories/index.htm assets/browse.js
git commit -m "feat: categories two-pane page (frameless, in-place)"
```

---

## Phase 5 — Script toggle (GA-Devanagari alternate index)

### Task 5.1: Collation helpers

**Files:**
- Create: `scripts/collation.mjs`
- Test: `scripts/tests/collation.test.mjs`

- [ ] **Step 1: Write failing tests** for `firstLetter(text, order)` and `sortBy(items, keyFn, order)`:
  given an explicit Devanagari `order` array, `firstLetter('आजूरो', devOrder)` returns `'आ'`, and
  `sortBy` orders strings by their first letter's index then by string.

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { firstLetter, sortByOrder, DEV_GA_ORDER } from '../collation.mjs';

test('firstLetter picks the leading Devanagari letter from the order', () => {
  assert.equal(firstLetter('आजूरो', DEV_GA_ORDER), 'आ');
  assert.equal(firstLetter('-आक', DEV_GA_ORDER), 'आ'); // skip leading hyphen
});
test('sortByOrder orders by letter index then lexicographically', () => {
  const out = sortByOrder(['कखग','आम','आज'], s => s, DEV_GA_ORDER).join(',');
  assert.equal(out, 'आज,आम,कखग');
});
```

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Implement** `collation.mjs`: `DEV_GA_ORDER` (the Devanagari letter sequence from
  `index-ga_in_sript/alphalinks.htm`), `firstLetter(text, order)` (strip leading non-letters like
  `-`, return the longest matching letter from `order`), `sortByOrder(items, keyFn, order)`.
  Export all. (A `HINDI_ORDER` constant too, from the Hindi alphalinks.)

- [ ] **Step 4: Run** → PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/collation.mjs scripts/tests/collation.test.mjs
git commit -m "feat: explicit Devanagari/Hindi collation helpers + tests"
```

### Task 5.2: Script toggle in chrome + browse

**Files:**
- Modify: `assets/chrome.js` (build `.scriptseg` toggle), `assets/browse.js` (re-sort + swap letter set)

- [ ] **Step 1:** Add `GAChrome.buildScriptToggle(options, onPick)` returning a `.scriptseg` element
  with one button per option (`[{key:'ipa',label:'a–z'},{key:'dev',label:'देव'}]`), first active;
  clicking swaps active and calls `onPick(key)`. Embed the `DEV_GA_ORDER`/`HINDI_ORDER` arrays
  (copied from `collation.mjs`) and an exported `firstLetter`/`sortByOrder` into chrome.js or a tiny
  `assets/collation-data.js` shared by the browser (avoid divergence: generate
  `assets/collation-data.js` from `collation.mjs` via a CLI step, mirroring `lexicon-letters.json`).

- [ ] **Step 2:** In `initIndexPage`, accept `scripts: [{key,label,order|'native'}]`. Render the
  toggle; on pick, re-derive the letter row letters (the distinct first-letters in the chosen order)
  and re-sort `#ilist`. For `english`: `[{key:'en',label:'a–z',order:'native'},{key:'dev',label:'देव',order:DEV_GA_ORDER}]`
  where the `dev` ordering sorts by the entry's `deva` (looked up from `search-index.json` by id).
  For `hindi`: native Hindi vs `dev`. For `devanagari`/`lexicon`: `ipa` vs `dev`.

- [ ] **Step 3: Verify with Playwright** on `index-english/index.htm`: toggle shows `a–z | देव`;
  clicking `देव` re-sorts the list by GA Devanagari and swaps the letter row to Devanagari letters;
  clicking back restores English order. Repeat on hindi + devanagari pages.

- [ ] **Step 4: Commit**

```bash
git add assets/chrome.js assets/browse.js assets/collation-data.js scripts/collation.mjs
git commit -m "feat: script toggle (native ⇄ GA-Devanagari) on index pages"
```

### Task 5.3: Lexicon Devanagari mode (data-driven)

**Files:**
- Modify: `assets/browse.js` (or a small `assets/lexicon-dev.js`), `assets/chrome.js` (lexicon toggle)

- [ ] **Step 1:** On lexicon pages, render the toggle `[a–z | देव]`. In `ipa` mode the row is the
  existing per-file IPA letters (page navigation, current behavior). In `dev` mode: fetch
  `search-index.json`, group entries by `firstLetter(deva, DEV_GA_ORDER)`, render the chosen
  Devanagari letter's entries as cards in the main column via `GACards.renderCard` (loading each
  entry's full card by `loadEntry` is too many fetches — instead build a lightweight card from the
  index fields: ipa, deva, en, hi, env, cat; acceptable for the Devanagari browse view). Default
  Devanagari letter = first; clicking a Devanagari letter shows that group. Persist mode in
  `sessionStorage['ga.script']` so it survives letter-page navigation.

- [ ] **Step 2: Verify with Playwright**: on `lexicon/01.htm`, toggling `देव` replaces the letter
  row with Devanagari letters and the cards with a Devanagari-grouped list; toggling back restores
  the IPA page view. Audio buttons still work on rendered cards.

- [ ] **Step 3: Commit**

```bash
git add assets/browse.js assets/chrome.js assets/lexicon-dev.js
git commit -m "feat: lexicon Devanagari browse mode (data-driven)"
```

---

## Phase 6 — Remove the dead frameset layer + final verification

### Task 6.1: Delete obsolete files & references

**Files:**
- Delete: `title.htm`, `categories/tree.htm`, `javascript/ftiens4.js`, `javascript/categoryNodes.js`,
  `javascript/ua.js`, `javascript/index-go.js`, `index-*/alphalinks.htm`.

- [ ] **Step 1:** Confirm nothing references them: `grep -rIl "title.htm\|index-go.js\|ftiens4\|categoryNodes\|ua.js\|alphalinks\|tree.htm" --include=*.htm --include=*.js .`
  Expected: only the files being deleted (and `browse.js` if it fetches `alphalinks.htm` — if so,
  inline the letter lists into `assets/*-letters.json` first, then delete alphalinks).

- [ ] **Step 2:** If `browse.js` still fetches `alphalinks.htm`, replace with generated
  `assets/<section>-letters.json` (add to the relevant `*-letters.mjs` generator) so the letters
  survive deletion. Re-verify the index pages.

- [ ] **Step 3:** Delete the files. **Commit**

```bash
git rm title.htm categories/tree.htm javascript/ftiens4.js javascript/categoryNodes.js javascript/ua.js javascript/index-go.js index-english/alphalinks.htm index-hindi/alphalinks.htm index-ga_in_sript/alphalinks.htm
git commit -m "chore: remove frameset/Treeview layer superseded by chrome.js + browse.js"
```

### Task 6.2: Remove mockups + full verification

- [ ] **Step 1:** Run the node suite:
  `node --test scripts/tests/collation.test.mjs scripts/tests/lexicon-letters.test.mjs scripts/tests/add-chrome.test.mjs scripts/tests/category-list.test.mjs scripts/tests/tag-environmental.test.mjs scripts/tests/build-search-index.test.mjs`
  Expected: all PASS.

- [ ] **Step 2: Playwright regression** across page types on a fresh server/port: lexicon (IPA + Dev
  toggle, letters, cards, audio), all three indexes (two-pane, term click, toggle, env filter, deep
  link), categories (list, cards, env). Confirm no `console` errors beyond the favicon 404.

- [ ] **Step 3:** Delete the `mockups/` scratch dir. Confirm `git status` clean of scratch.

```bash
rm -rf mockups
```

- [ ] **Step 4: Commit** (if anything remained) and finish via the finishing-a-development-branch skill.

---

## Self-review notes

- **Spec coverage:** chrome (0), lexicon Option B (1), renderer reuse (2), reverse indexes two-pane
  (3), env filter (3.1/3.3), categories (4), script toggle incl. EN/HI gloss⇄Devanagari and lexicon
  Devanagari mode (5), collation (5.1), removals (6). All spec sections mapped.
- **Known simplification (lists from existing index HTML):** preserved — `initIndexPage` parses the
  existing `index-*/NN.htm` tables (multi-sense rows kept); `search-index.json` only supplies `deva`
  for the alternate sort and `env` for filtering.
- **Verification reality:** most steps are DOM/visual → Playwright, since the markup/CSS comes from
  approved mockups and isn't unit-testable without jsdom (no deps allowed). Pure logic (collation,
  letter/category maps, addChrome idempotency, filter env) is `node:test`-covered.
- **bfcache/caching caveat** is called out in Conventions; use fresh ports + `?cb`.
