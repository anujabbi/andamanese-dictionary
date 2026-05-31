# ETYM / MORPH Tag Filtering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users filter the dictionary to entries that carry an Etymology or Morphology note, on the homepage and across all four legacy frameset views.

**Architecture:** A single scope selector ("All entries / With etymology / With morphology") in the shared legacy top bar (`title.htm`) and in the homepage search bar writes `sessionStorage["ga.filter"]`. Every content page reads that value on load and hides non-matching entries locally — entry pages (lexicon + categories) via the existing `assets/cards.js` (which already parses `etym`/`morph`), reverse-index panes via a new `assets/filter.js` that maps each `go('NN','id')` link against an id-set built from `assets/search-index.json`. The build script is extended to emit `etym`/`morph` fields.

**Tech Stack:** Plain HTML/CSS/JS (no build, no modules, vanilla IIFEs). Zero-dependency Node ESM for the build/injector scripts. `node:test` for the build script. Work happens on branch `feat/etym-morph-filter`.

**Testing note:** Per repo convention, only the pure build-script logic is unit-tested (`node:test`); the browser IIFEs (`cards.js`, `home.js`) have no automated tests and are verified manually with a local server. This plan follows that convention: Task 1 is full TDD; browser tasks use explicit manual verification with exact expected observations.

---

## File Structure

- `scripts/build-search-index.mjs` — add `morph`/`etym` extraction to `parseEntry`.
- `scripts/tests/fixtures/sample-lexicon.htm` — add fixture entries with tags.
- `scripts/tests/build-search-index.test.mjs` — new extraction tests; bump block count.
- `assets/search-index.json` — regenerated output (committed).
- `assets/cards.css` — `.ga-filtered-out` + `.ga-empty` rules.
- `assets/cards.js` — set `data-has-etym`/`data-has-morph`; apply filter after render.
- `assets/filter.js` — NEW: reverse-index pane filtering.
- `scripts/inject-filter-includes.mjs` — NEW: one-shot injector adding `cards.css` + `filter.js` includes to index panes.
- `index-*/NN.htm` (~78 files) — gain the two includes (via the injector).
- `title.htm` — scope selector + change handler + inline selector styles.
- `index.htm`, `assets/home.js`, `assets/home.css` — homepage selector + filter.

---

## Task 1: Build script emits `morph` and `etym` (TDD)

**Files:**
- Modify: `scripts/tests/fixtures/sample-lexicon.htm`
- Modify: `scripts/tests/build-search-index.test.mjs`
- Modify: `scripts/build-search-index.mjs:51-69` (`parseEntry`)
- Regenerate: `assets/search-index.json`

- [ ] **Step 1: Add two tagged fixture entries**

In `scripts/tests/fixtures/sample-lexicon.htm`, insert these two paragraphs immediately **before** the closing `</body></html>` (after the existing `homonym-word` entry e5). `e6` carries both tags and includes the nested-Hindi `lpEtymology` span (the trap); `e7` carries morph only.

```html
<p class="lpLexEntryPara"><span id="e6" class="lpLexEntryName">tagged-both</span><span class="lpLexEntryNameGA_in_Sript">दोनों</span> <span class="lpMiniHeading">MORPH:&nbsp;</span><span class="lpMorph">tag-both</span><span class="lpPunctuation">.</span> <span class="lpMiniHeading">Etym:</span> <span class="lpEtymology">Bale</span><span class="lpPunctuation">;</span> <span class="lpEtymology"><span class="lpUserStylefn">बाले</span></span><span class="lpPunctuation">.</span> <span class="lpGlossEnglish">both tags; </span><span class="lpGlossHindi">दोनों टैग.</span> <span class="lpCategory">test-category</span></p>

<p class="lpLexEntryPara"><span id="e7" class="lpLexEntryName">morph-only</span><span class="lpLexEntryNameGA_in_Sript">केवल</span> <span class="lpMiniHeading">MORPH:&nbsp;</span><span class="lpMorph">m-only</span><span class="lpPunctuation">.</span> <span class="lpGlossEnglish">morph only; </span><span class="lpGlossHindi">केवल आकृति.</span> <span class="lpCategory">test-category</span></p>
```

- [ ] **Step 2: Update the block-count test and add extraction tests**

In `scripts/tests/build-search-index.test.mjs`, change the count assertion in the `extractEntryBlocks returns one string per entry paragraph` test from `5` to `7`:

```javascript
test('extractEntryBlocks returns one string per entry paragraph', () => {
  const blocks = extractEntryBlocks(fixtureHtml);
  assert.equal(blocks.length, 7);
  assert.ok(blocks[0].includes('main-audio-word'));
  assert.ok(blocks[4].includes('homonym-word'));
});
```

Then append these new tests at the end of the file:

```javascript
test('parseEntry extracts morph and the GA etymology (not the Hindi span)', () => {
  const blocks = extractEntryBlocks(fixtureHtml);
  const entry = parseEntry(blocks[5], 'sample-lexicon.htm');
  assert.equal(entry.morph, 'tag-both');
  assert.equal(entry.etym, 'Bale'); // GA value, never the nested बाले
});

test('parseEntry omits etym when only morph is present', () => {
  const blocks = extractEntryBlocks(fixtureHtml);
  const entry = parseEntry(blocks[6], 'sample-lexicon.htm');
  assert.equal(entry.morph, 'm-only');
  assert.equal(entry.etym, undefined);
});

test('parseEntry omits morph and etym when neither is present', () => {
  const blocks = extractEntryBlocks(fixtureHtml);
  const entry = parseEntry(blocks[2], 'sample-lexicon.htm'); // no-audio-word
  assert.equal(entry.morph, undefined);
  assert.equal(entry.etym, undefined);
});
```

- [ ] **Step 3: Run tests to verify the new ones fail**

Run: `node --test scripts/tests/`
Expected: the three new tests FAIL (`entry.morph`/`entry.etym` are `undefined`); the count test FAILS until the fixture edit is saved (it should PASS now since blocks are added). Net: the morph/etym assertions fail because `parseEntry` does not yet extract them.

- [ ] **Step 4: Implement extraction in `parseEntry`**

In `scripts/build-search-index.mjs`, inside `parseEntry`, add the two extractions next to the existing `cat` line, and add the two conditional assignments next to the existing `if (cat)` block:

```javascript
  const cat = cleanGloss(firstMatch(block, /<span\s+class="lpCategory">([^<]*)<\/span>/));
  const morph = cleanGloss(firstMatch(block, /<span\s+class="lpMorph">([^<]*)<\/span>/));
  const etym = cleanGloss(firstMatch(block, /<span\s+class="lpEtymology">([^<]*)<\/span>/));
  const audio = extractMainAudio(block);

  const entry = { id, file, ipa };
  if (deva) entry.deva = deva;
  if (en) entry.en = en;
  if (hi) entry.hi = hi;
  if (cat) entry.cat = cat;
  if (morph) entry.morph = morph;
  if (etym) entry.etym = etym;
  if (audio) entry.audio = audio;
  return entry;
```

(The `[^<]*` body makes the `lpEtymology` regex match only the GA span — the nested Hindi span's body starts with `<span`, so it cannot match. `cleanGloss(null)` returns `''`, so absent tags stay omitted.)

- [ ] **Step 5: Run tests to verify all pass**

Run: `node --test scripts/tests/`
Expected: all tests PASS (existing + 3 new + updated count).

- [ ] **Step 6: Regenerate the search index**

Run: `node scripts/build-search-index.mjs`
Expected: `Wrote 3735 entries to …/assets/search-index.json`

Sanity-check that fields landed (PowerShell):
Run: `node -e "const a=require('./assets/search-index.json');console.log(a.filter(e=>e.etym).length+' etym, '+a.filter(e=>e.morph).length+' morph')"`
Expected: roughly `~520 etym, ~1630 morph` (non-zero, in that ballpark).

- [ ] **Step 7: Commit**

```bash
git add scripts/build-search-index.mjs scripts/tests/ assets/search-index.json
git commit -m "feat: emit etym/morph fields in search index"
```

---

## Task 2: Filter + empty-state styles in `cards.css`

**Files:**
- Modify: `assets/cards.css` (append at end)

- [ ] **Step 1: Append the filter rules**

Add to the very end of `assets/cards.css`:

```css

/* ---- Tag filter (etym / morph) ---- */
.ga-filtered-out { display: none !important; }
.ga-empty {
  margin: 24px auto;
  max-width: 760px;
  padding: 0 16px;
  text-align: center;
  font-style: italic;
  color: #8a7c66;
}
```

- [ ] **Step 2: Verify CSS is well-formed**

Run: `node -e "const c=require('fs').readFileSync('assets/cards.css','utf8');const o=(c.match(/{/g)||[]).length,cl=(c.match(/}/g)||[]).length;if(o!==cl)throw new Error('brace mismatch '+o+'/'+cl);console.log('braces balanced',o)"`
Expected: `braces balanced <n>` (no throw).

- [ ] **Step 3: Commit**

```bash
git add assets/cards.css
git commit -m "feat: add tag-filter hide + empty-state styles"
```

---

## Task 3: Entry-page filtering in `cards.js`

**Files:**
- Modify: `assets/cards.js` (add helper; set data attrs in `renderCard`; apply after `transformPage`)

- [ ] **Step 1: Add `readFilter` and `applyFilter` helpers**

In `assets/cards.js`, just after the `'use strict';` line, add:

```javascript
  function readFilter() {
    try {
      var v = sessionStorage.getItem('ga.filter');
      return (v === 'etym' || v === 'morph') ? v : '';
    } catch (e) { return ''; }
  }

  function applyFilter(container) {
    var f = readFilter();
    var cards = container.querySelectorAll('.entry');
    var visible = 0;
    cards.forEach(function (card) {
      var keep = !f || (f === 'etym' ? card.dataset.hasEtym : card.dataset.hasMorph);
      card.classList.toggle('ga-filtered-out', !keep);
      if (keep) visible++;
    });
    var prev = container.querySelector('.ga-empty');
    if (prev) prev.remove();
    if (f && visible === 0) {
      var note = document.createElement('p');
      note.className = 'ga-empty';
      note.textContent = f === 'etym'
        ? 'No entries with an etymology note on this page.'
        : 'No entries with a morphology note on this page.';
      container.appendChild(note);
    }
  }
```

- [ ] **Step 2: Set data attributes when rendering a card**

In `renderCard`, immediately after the existing `if (entry.id) card.id = entry.id;` line, add:

```javascript
    if (entry.etym) card.dataset.hasEtym = '1';
    if (entry.morph) card.dataset.hasMorph = '1';
```

- [ ] **Step 3: Apply the filter after the page is transformed**

In `transformPage`, immediately after the existing `installAudioHandler(container);` line (the last line of the function), add:

```javascript
    applyFilter(container);
```

- [ ] **Step 4: Manual verification (local server)**

Start a server from the repo root:
Run: `python -m http.server 8000`
Then in a browser:
1. Open `http://localhost:8000/lexicon/index.htm`.
2. In the devtools console run: `sessionStorage.setItem('ga.filter','etym')`.
3. Click letter **b** in the top bar (loads a fresh page).
Expected: only cards that show an "Etym" note remain; others are gone. If a page has none, the italic "No entries with an etymology note on this page." line shows.
4. Console: `sessionStorage.setItem('ga.filter','')`, reload.
Expected: all cards visible again, no empty note.

- [ ] **Step 5: Commit**

```bash
git add assets/cards.js
git commit -m "feat: filter entry-page cards by etym/morph from sessionStorage"
```

---

## Task 4: Reverse-index pane filtering (`filter.js` + injector + includes)

**Files:**
- Create: `assets/filter.js`
- Create: `scripts/inject-filter-includes.mjs`
- Modify (via injector): `index-english/NN.htm`, `index-hindi/NN.htm`, `index-ga_in_sript/NN.htm`

- [ ] **Step 1: Create `assets/filter.js`**

```javascript
/* assets/filter.js — hide reverse-index rows that lack the active tag
   (etym / morph), read from sessionStorage["ga.filter"]. Loaded only by
   index-*/NN.htm panes. Vanilla IIFE; no modules. */
(function () {
  'use strict';

  function readFilter() {
    try {
      var v = sessionStorage.getItem('ga.filter');
      return (v === 'etym' || v === 'morph') ? v : '';
    } catch (e) { return ''; }
  }

  function goId(href) {
    // "javascript:go('28', '3525')" -> "e3525"
    var m = /go\(\s*'[^']*'\s*,\s*'(\d+)'\s*\)/.exec(href || '');
    return m ? 'e' + m[1] : null;
  }

  function qualifyingIds(index, filter) {
    var set = new Set();
    for (var i = 0; i < index.length; i++) {
      var e = index[i];
      if (filter === 'etym' ? e.etym : e.morph) set.add(e.id);
    }
    return set;
  }

  function apply(index, filter) {
    var ids = qualifyingIds(index, filter);
    var rows = document.querySelectorAll('tr');
    var considered = 0, visible = 0;
    rows.forEach(function (tr) {
      var a = tr.querySelector('a[href^="javascript:go("]');
      if (!a) return;
      considered++;
      var id = goId(a.getAttribute('href'));
      var keep = !!(id && ids.has(id));
      tr.classList.toggle('ga-filtered-out', !keep);
      if (keep) visible++;
    });
    var prev = document.querySelector('.ga-empty');
    if (prev) prev.remove();
    if (considered > 0 && visible === 0) {
      var note = document.createElement('p');
      note.className = 'ga-empty';
      note.textContent = filter === 'etym'
        ? 'No entries with an etymology note on this page.'
        : 'No entries with a morphology note on this page.';
      document.body.appendChild(note);
    }
  }

  function init() {
    var filter = readFilter();
    if (!filter) return;
    fetch('../assets/search-index.json')
      .then(function (r) { return r.json(); })
      .then(function (index) { apply(index, filter); })
      .catch(function (err) { console.warn('filter.js: index load failed', err); });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
```

- [ ] **Step 2: Create the injector `scripts/inject-filter-includes.mjs`**

```javascript
/* scripts/inject-filter-includes.mjs — add the cards.css <link> and the
   filter.js <script> to every reverse-index pane (index-*/NN.htm).
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
    if (!match) { console.warn(`SKIP ${relDir}/${fname}: lexiquepro.css <link> not found`); skipped++; continue; }
    const indent = match[1].match(/^[ \t]*/)[0];
    const insertion = '\n' + indent + CSS_TAG + '\n' + indent + JS_TAG;
    writeFileSync(path, html.replace(ANCHOR_RE, match[1] + insertion), 'utf8');
    modified++;
  }
  console.log(`${relDir}: ${modified} modified, ${skipped} skipped`);
  totalMod += modified; totalSkip += skipped;
}
console.log(`TOTAL: ${totalMod} modified, ${totalSkip} skipped`);
```

- [ ] **Step 3: Run the injector**

Run: `node scripts/inject-filter-includes.mjs`
Expected: each `index-*` dir reports its file count modified, `0 skipped`, e.g. `TOTAL: 78 modified, 0 skipped` (exact count = number of `NN.htm` panes across the three dirs).

- [ ] **Step 4: Verify includes landed and are idempotent**

Run: `node scripts/inject-filter-includes.mjs`
Expected: `TOTAL: 0 modified, <n> skipped` (re-run skips everything).

Spot-check one file (PowerShell):
Run: `Select-String -Path index-english/01.htm -Pattern 'assets/filter.js','assets/cards.css'`
Expected: both lines present in the `<head>`.

- [ ] **Step 5: Manual verification (local server)**

With `python -m http.server 8000` running:
1. Open `http://localhost:8000/index-english/index.htm`.
2. Console: `sessionStorage.setItem('ga.filter','etym')`.
3. Click an alphabet letter in the index's own letter bar to load a fresh index pane (e.g. **B**).
Expected: index rows whose target entry has no etymology disappear; remaining rows still link correctly. With no qualifying rows, the empty note shows.
4. Console: `sessionStorage.setItem('ga.filter','')`, reload.
Expected: all index rows return.

- [ ] **Step 6: Commit**

```bash
git add assets/filter.js scripts/inject-filter-includes.mjs index-english/ index-hindi/ index-ga_in_sript/
git commit -m "feat: filter reverse-index panes by etym/morph"
```

---

## Task 5: Scope selector in the shared top bar (`title.htm`)

**Files:**
- Modify: `title.htm` (head `<style>`, selector markup, end-of-body `<script>`)

- [ ] **Step 1: Add inline selector styles to `<head>`**

In `title.htm`, immediately after the existing `<link rel="stylesheet" href="stylesheets/lexiquepro.css" type="text/css" />` line, add:

```html
 <style>
  .ga-scope-wrap {
    display: inline-flex; align-items: center; gap: 6px;
    margin-top: 4px;
    background: #fff; border: 1px solid #c9a36a; border-radius: 999px;
    padding: 2px 6px 2px 10px;
  }
  .ga-scope-wrap .ga-scope-label {
    font-size: 9px; letter-spacing: 0.6px; text-transform: uppercase; color: #8a7c66;
  }
  .ga-scope-wrap select {
    border: none; background: transparent;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
    font-size: 12px; color: #2a1f15; padding: 1px 2px; outline: none; cursor: pointer;
  }
 </style>
```

- [ ] **Step 2: Add the selector markup**

In `title.htm`, replace the title cell:

```html
  <td><p class="lpTitleMain">GA</p></td>
```

with:

```html
  <td><p class="lpTitleMain">GA</p>
   <span class="ga-scope-wrap">
    <span class="ga-scope-label">Show</span>
    <select id="ga-scope">
     <option value="">All entries</option>
     <option value="etym">With etymology</option>
     <option value="morph">With morphology</option>
    </select>
   </span>
  </td>
```

- [ ] **Step 3: Add the handler script before `</body>`**

In `title.htm`, immediately before the closing `</body>` tag, add:

```html
<script>
(function () {
  function readFilter() {
    try { var v = sessionStorage.getItem('ga.filter');
      return (v === 'etym' || v === 'morph') ? v : ''; } catch (e) { return ''; }
  }
  var sel = document.getElementById('ga-scope');
  if (!sel) return;
  sel.value = readFilter();
  sel.addEventListener('change', function () {
    var v = (sel.value === 'etym' || sel.value === 'morph') ? sel.value : '';
    try { sessionStorage.setItem('ga.filter', v); } catch (e) {}
    var names = ['basefrm', 'indexframe'];
    for (var i = 0; i < names.length; i++) {
      try {
        var fr = parent[names[i]];
        if (fr && fr.location && typeof fr.location.reload === 'function') fr.location.reload();
      } catch (e) { /* frame absent in this view */ }
    }
  });
})();
</script>
```

- [ ] **Step 4: Manual verification (local server)**

With `python -m http.server 8000` running, for **each** of these URLs:
- `http://localhost:8000/lexicon/index.htm`
- `http://localhost:8000/index-english/index.htm`
- `http://localhost:8000/index-hindi/index.htm`
- `http://localhost:8000/index-ga_in_sript/index.htm`
- `http://localhost:8000/categories/index.htm`

1. The "Show" selector appears in the top bar.
2. Choose **With etymology**.
Expected: the content frame(s) reload and show only etymology entries; the index views also prune their index pane. Selecting **With morphology** switches the filter; **All entries** restores everything. The selector keeps its value when you navigate letters/entries within the view.

- [ ] **Step 5: Commit**

```bash
git add title.htm
git commit -m "feat: add etym/morph scope selector to shared top bar"
```

---

## Task 6: Homepage scope selector + autocomplete filtering

**Files:**
- Modify: `index.htm` (selector markup)
- Modify: `assets/home.js` (`searchIndex` signature, `onInput`, bootstrap wiring)
- Modify: `assets/home.css` (selector styles)

- [ ] **Step 1: Add the selector markup to `index.htm`**

In `index.htm`, inside the `<form class="search-form" …>`, immediately before `<div class="search-wrap">`, add:

```html
      <div class="ga-scope-wrap">
        <span class="ga-scope-label">Show</span>
        <select id="ga-scope">
          <option value="">All entries</option>
          <option value="etym">With etymology</option>
          <option value="morph">With morphology</option>
        </select>
      </div>
```

- [ ] **Step 2: Add selector styles to `assets/home.css`**

Append to the end of `assets/home.css` (before any trailing `@media` is fine — just add at end of file):

```css

/* Scope selector */
.ga-scope-wrap {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin: 0 auto 12px;
  background: #fff;
  border: 1px solid var(--accent-soft);
  border-radius: 999px;
  padding: 4px 8px 4px 12px;
}
.ga-scope-wrap .ga-scope-label {
  font-size: 10px;
  letter-spacing: 0.6px;
  text-transform: uppercase;
  color: var(--ink-mute);
}
.ga-scope-wrap select {
  border: none;
  background: transparent;
  font-family: var(--sans);
  font-size: 12px;
  color: var(--ink);
  padding: 2px 4px;
  outline: none;
  cursor: pointer;
}
```

- [ ] **Step 3: Add filter support to `searchIndex` in `assets/home.js`**

Replace the start of `searchIndex` (the signature and the early-return) so it accepts and applies a `filter`:

```javascript
  function searchIndex(query, index, filter) {
    const q = query.trim().toLowerCase();
    if (!q || !index) return [];
    const scored = [];
    for (const e of index) {
      if (filter === 'etym' && !e.etym) continue;
      if (filter === 'morph' && !e.morph) continue;
      let score = 0;
      let field = null;
```

(Leave the rest of the loop and the `scored.sort(...) / slice` unchanged.)

- [ ] **Step 4: Add `activeFilter` and pass it from `onInput`**

In `assets/home.js`, add this helper just above `onInput`:

```javascript
  function activeFilter() {
    const sel = document.getElementById('ga-scope');
    const v = sel ? sel.value : '';
    return (v === 'etym' || v === 'morph') ? v : '';
  }
```

Then in `onInput`, change the results line:

```javascript
    const results = searchIndex(q, INDEX, activeFilter());
```

- [ ] **Step 5: Wire the selector in bootstrap**

In `assets/home.js`, add this function near `bindSearchBox`:

```javascript
  function bindScope() {
    const sel = document.getElementById('ga-scope');
    if (!sel) return;
    try {
      const v = sessionStorage.getItem('ga.filter');
      if (v === 'etym' || v === 'morph') sel.value = v;
    } catch (e) { /* ignore */ }
    sel.addEventListener('change', function () {
      try { sessionStorage.setItem('ga.filter', activeFilter()); } catch (e) { /* ignore */ }
      onInput();
    });
  }
```

Then call it inside `init()`, right after `bindSearchBox();`:

```javascript
  function init() {
    bindSearchBox();
    bindScope();
    document.getElementById('wotd').addEventListener('click', onWotdClick);
```

- [ ] **Step 6: Manual verification (local server)**

With `python -m http.server 8000` running:
1. Open `http://localhost:8000/index.htm`.
2. The "Show" selector appears above the search box.
3. Type a common prefix (e.g. `b`) with **All entries** → results appear.
4. Switch to **With etymology** → results shrink to entries that have an etymology; **With morphology** likewise; **All entries** restores.
5. Selector choice persists: set **With etymology** on the homepage, then open `http://localhost:8000/lexicon/index.htm` in the same tab — the top-bar selector reads "With etymology" and the lexicon is filtered.

- [ ] **Step 7: Commit**

```bash
git add index.htm assets/home.js assets/home.css
git commit -m "feat: add etym/morph scope selector to homepage search"
```

---

## Task 7: Update GitHub issue #2

**Files:** none (tracker only)

- [ ] **Step 1: Edit the issue body to reflect the expanded scope**

Run:

```bash
gh issue edit 2 --body "Split out from #1.

## Feature Description
Add tag filtering so users can narrow the dictionary to entries that carry an **ETYM** (Etymology) or **MORPH** (Morphology) note — on the modern homepage **and** across all four legacy frameset views (lexicon, English/Hindi/Devanagari reverse indexes, categories).

## Solution (implemented)
- \`scripts/build-search-index.mjs\` emits \`morph\`/\`etym\` per entry (GA etymology, not the nested Hindi span); \`node:test\` covers extraction.
- A scope selector (All entries / With etymology / With morphology) in the shared top bar (\`title.htm\`) and the homepage search bar, writing \`sessionStorage[\"ga.filter\"]\`.
- Entry pages filter via \`assets/cards.js\`; reverse-index panes via new \`assets/filter.js\`; homepage autocomplete via \`assets/home.js\`.
- Behavior: hide untagged entries. State: sessionStorage (no URL param).

See design spec: docs/superpowers/specs/2026-05-31-etym-morph-filter-design.md"
```

Expected: `gh` prints the updated issue URL.

- [ ] **Step 2: Verify**

Run: `gh issue view 2`
Expected: the body shows the expanded scope.

---

## Final verification

- [ ] **Step 1: Tests green**

Run: `node --test scripts/tests/`
Expected: all PASS.

- [ ] **Step 2: Index regenerated and committed**

Run: `git status --short`
Expected: clean working tree (no uncommitted `assets/search-index.json` drift). If dirty, run `node scripts/build-search-index.mjs`, then commit any change.

- [ ] **Step 3: Full manual pass**

Re-run the manual matrix from the spec's Testing section across homepage + all four legacy views with each selector value, confirming hide/restore behavior and that "All entries" fully restores every view.

---

## Self-review notes

- **Spec coverage:** §1 data layer → Task 1; §2 entry filtering → Tasks 2–3; §3 index filtering → Task 4; §4 styles → Tasks 2, 5, 6; §5 control (legacy) → Task 5, (homepage) → Task 6; §6 includes → Task 4; follow-up issue → Task 7.
- **Refinement vs spec §4:** scope-selector styles live where each consumer loads CSS — inline `<style>` in `title.htm` and in `home.css` — because `title.htm` and the homepage do not load `cards.css`. `cards.css` carries only `.ga-filtered-out` / `.ga-empty`, which the index panes pick up via the added `cards.css` link.
- **Type/name consistency:** `readFilter()` (cards.js, filter.js, title.htm), `activeFilter()` (home.js), `sessionStorage["ga.filter"]`, classes `ga-filtered-out` / `ga-empty`, attrs `data-has-etym` / `data-has-morph`, JSON fields `etym` / `morph` — used identically across tasks.
- **No placeholders:** every code/command step is complete.
