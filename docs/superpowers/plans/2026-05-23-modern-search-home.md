# Modern Search Homepage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the redirect at `index.htm` with a modern, mobile-friendly search-driven homepage that bridges into the existing Lexique Pro frameset pages.

**Architecture:** Static HTML/CSS/vanilla-JS homepage at the repo root. A Node.js builder script reads `lexicon/*.htm` once and produces a compact `assets/search-index.json` that the homepage loads at startup. The homepage's autocomplete dropdown, on click, navigates the user to the existing `lexicon/NN.htm#eN` page — the legacy frameset experience is untouched.

**Tech Stack:** HTML5, CSS3 (custom properties), vanilla JS (no modules, no bundler), Node.js (≥18, built-in `node:test` and `node:fs` only — zero dependencies).

**Environment notes:**
- This project is **not** a git repository. Commit steps are omitted. Treat the end of each task as a natural pause point for review.
- All work happens outside Lexique-Pro-owned directories (`lexicon/`, `index-english/`, `index-hindi/`, `index-ga_in_sript/`, `categories/`, `title.htm`, `javascript/`, `stylesheets/`). The only file inside that footprint we touch is the root `index.htm`, which CLAUDE.md explicitly lists as safe to edit.
- The builder script (Node) has unit tests via `node:test`. The browser-side JS does **not** have automated tests; verification is the manual checklist in Task 17.

---

## File structure

```
index.htm                                # MODIFY — replace 7-line redirect with new homepage
about.htm                                # CREATE — about page
assets/                                  # CREATE — all new front-end assets live here
  home.css                               # CREATE — palette, typography, layout, autocomplete styles
  home.js                                # CREATE — single IIFE, vanilla JS, no modules
  search-index.json                      # GENERATED — produced by builder script
scripts/                                 # CREATE — build tooling
  build-search-index.mjs                 # CREATE — Node parser
  tests/                                 # CREATE
    build-search-index.test.mjs          # CREATE — node --test
    fixtures/
      sample-lexicon.htm                 # CREATE — small synthetic fixture
lexicon/, index-*/, categories/, title.htm, javascript/, stylesheets/   # UNTOUCHED
```

Responsibilities:

- `index.htm` — static page skeleton. References `assets/home.css` and `assets/home.js`. Renders meaningfully without JS (brand, tagline, search input that submits to a fallback URL, browse links).
- `about.htm` — static prose page in the same visual language. No JS.
- `assets/home.css` — all visual styling. Custom properties at `:root` for the palette tokens. Mobile breakpoint at 640px.
- `assets/home.js` — one IIFE, ~250 lines. Inside, named functions for each unit of work (`loadIndex`, `searchIndex`, `renderDropdown`, `wordOfTheDay`, `playAudio`, `recentEntries`, `recordRecent`, `bindSearchBox`). No globals beyond the IIFE.
- `assets/search-index.json` — generated artifact. ~150 KB. Committed alongside source (so the site works without re-running the builder on every deploy).
- `scripts/build-search-index.mjs` — Node ESM script. Reads `lexicon/*.htm`, extracts entries, writes JSON. Composed of pure functions: `extractEntryBlocks`, `parseEntry`, `extractMainAudio`, `cleanGloss`.
- `scripts/tests/build-search-index.test.mjs` — `node:test` suite covering the parser pure functions against `sample-lexicon.htm`.

---

## Task 1: Scaffolding

**Files:**
- Create: `assets/`, `scripts/`, `scripts/tests/`, `scripts/tests/fixtures/`

- [ ] **Step 1: Create directories**

Run:

```bash
mkdir -p assets scripts/tests/fixtures
```

- [ ] **Step 2: Verify the directories exist**

Run:

```bash
ls -la assets scripts scripts/tests scripts/tests/fixtures
```

Expected: each command lists an empty directory (or `.` and `..` only).

---

## Task 2: Parser fixture

**Files:**
- Create: `scripts/tests/fixtures/sample-lexicon.htm`

This fixture covers every parser edge case in one small file. Tests in Task 3 will assert against it.

- [ ] **Step 1: Write the fixture**

Create `scripts/tests/fixtures/sample-lexicon.htm` with exactly this content:

```html
<!DOCTYPE html>
<html><head><meta charset="utf-8"/></head><body>

<p class="lpLexEntryPara"><a href="../audio/main word.wav"><img border="0" src="../images/sound-icon.png"/></a> <span id="e1" class="lpLexEntryName">main-audio-word</span><span class="lpSpAfterEntryName">&nbsp;</span><span class="lpLexEntryNameGA_in_Sript">मुख्य</span> <span class="lpGlossEnglish">main word; </span><span class="lpGlossHindi">मुख्य शब्द.</span> <span class="lpMiniHeading">SD:&nbsp;</span><span class="lpCategory">test-category</span></p>

<p class="lpLexEntryPara"><span id="e2" class="lpLexEntryName">example-only-audio</span><span class="lpLexEntryNameGA_in_Sript">उदाहरण</span> <span class="lpGlossEnglish">example only; </span><span class="lpGlossHindi">उदाहरण.</span> <span class="lpCategory">test-category</span> <a href="../audio/example.wav"><img src="../images/sound-icon.png"/></a> <span class="lpExample">example sentence</span></p>

<p class="lpLexEntryPara"><span id="e3" class="lpLexEntryName">no-audio-word</span><span class="lpLexEntryNameGA_in_Sript">बिना-ध्वनि</span> <span class="lpGlossEnglish">silent; </span><span class="lpGlossHindi">मूक.</span></p>

<p class="lpLexEntryPara"><span id="e4" class="lpLexEntryName">no-english-word</span><span class="lpLexEntryNameGA_in_Sript">अंग्रेज़ी-नहीं</span> <span class="lpGlossHindi">केवल हिंदी.</span></p>

<p class="lpLexEntryPara"><span id="e5" class="lpLexEntryName">homonym-word</span><sub><span class="lpHomonymIndex">2</span></sub><span class="lpLexEntryNameGA_in_Sript">समनाम</span> <span class="lpGlossEnglish">homonym sense 2; </span><span class="lpGlossHindi">समनाम.</span></p>

</body></html>
```

- [ ] **Step 2: Verify file size**

Run:

```bash
wc -c scripts/tests/fixtures/sample-lexicon.htm
```

Expected: a small file (≲2 KB). The exact byte count depends on platform line endings; what matters is the file was written and is readable.

---

## Task 3: Parser pure functions (TDD)

**Files:**
- Create: `scripts/tests/build-search-index.test.mjs`
- Create: `scripts/build-search-index.mjs` (initially just function exports)

We use Node's built-in `node:test` runner — no npm install required. Files are `.mjs` so Node treats them as ES modules.

- [ ] **Step 1: Write the test file**

Create `scripts/tests/build-search-index.test.mjs`:

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  extractEntryBlocks,
  parseEntry,
  extractMainAudio,
  cleanGloss,
} from '../build-search-index.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const fixtureHtml = readFileSync(join(here, 'fixtures/sample-lexicon.htm'), 'utf8');

test('cleanGloss trims whitespace and trailing punctuation', () => {
  assert.equal(cleanGloss('  main word;   '), 'main word');
  assert.equal(cleanGloss('मुख्य शब्द.'), 'मुख्य शब्द');
  assert.equal(cleanGloss('two glosses; second sense; '), 'two glosses; second sense');
  assert.equal(cleanGloss(''), '');
});

test('extractEntryBlocks returns one string per entry paragraph', () => {
  const blocks = extractEntryBlocks(fixtureHtml);
  assert.equal(blocks.length, 5);
  assert.ok(blocks[0].includes('main-audio-word'));
  assert.ok(blocks[4].includes('homonym-word'));
});

test('extractMainAudio finds audio link BEFORE the headword', () => {
  const blocks = extractEntryBlocks(fixtureHtml);
  assert.equal(extractMainAudio(blocks[0]), 'audio/main word.wav');
});

test('extractMainAudio ignores audio link AFTER the headword (example audio)', () => {
  const blocks = extractEntryBlocks(fixtureHtml);
  assert.equal(extractMainAudio(blocks[1]), null);
});

test('extractMainAudio returns null when there is no audio link at all', () => {
  const blocks = extractEntryBlocks(fixtureHtml);
  assert.equal(extractMainAudio(blocks[2]), null);
});

test('parseEntry extracts all fields when present', () => {
  const blocks = extractEntryBlocks(fixtureHtml);
  const entry = parseEntry(blocks[0], 'sample-lexicon.htm');
  assert.deepEqual(entry, {
    id: 'e1',
    file: 'sample-lexicon.htm',
    ipa: 'main-audio-word',
    deva: 'मुख्य',
    en: 'main word',
    hi: 'मुख्य शब्द',
    cat: 'test-category',
    audio: 'audio/main word.wav',
  });
});

test('parseEntry omits audio when no main audio present', () => {
  const blocks = extractEntryBlocks(fixtureHtml);
  const entry = parseEntry(blocks[1], 'sample-lexicon.htm');
  assert.equal(entry.audio, undefined);
  assert.equal(entry.en, 'example only');
});

test('parseEntry omits en when no English gloss present', () => {
  const blocks = extractEntryBlocks(fixtureHtml);
  const entry = parseEntry(blocks[3], 'sample-lexicon.htm');
  assert.equal(entry.en, undefined);
  assert.equal(entry.hi, 'केवल हिंदी');
});

test('parseEntry strips homonym subscripts from the IPA headword', () => {
  const blocks = extractEntryBlocks(fixtureHtml);
  const entry = parseEntry(blocks[4], 'sample-lexicon.htm');
  assert.equal(entry.ipa, 'homonym-word');
});
```

- [ ] **Step 2: Run the test file. Expect failures.**

Run:

```bash
node --test scripts/tests/build-search-index.test.mjs
```

Expected: ALL tests fail. Errors mention "Cannot find module" or similar — the implementation file doesn't exist yet.

- [ ] **Step 3: Write the minimal implementation**

Create `scripts/build-search-index.mjs`:

```javascript
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// ---------- Pure parsing primitives ----------

export function cleanGloss(text) {
  if (!text) return '';
  return text.replace(/[\s;.,]+$/, '').trim();
}

export function extractEntryBlocks(html) {
  // Each entry is a <p class="lpLexEntryPara">...</p>.
  // Paragraphs cannot nest, so a non-greedy regex on a single string is sufficient.
  const blocks = [];
  const re = /<p class="lpLexEntryPara">([\s\S]*?)<\/p>/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    blocks.push(m[1]);
  }
  return blocks;
}

export function extractMainAudio(block) {
  // Main audio: an <a href="../audio/..."> that appears BEFORE the lpLexEntryName span.
  const headwordIndex = block.search(/<span\s+id="e\d+"\s+class="lpLexEntryName">/);
  if (headwordIndex === -1) return null;
  const before = block.slice(0, headwordIndex);
  const m = before.match(/<a\s+href="\.\.\/(audio\/[^"]+)"/);
  return m ? m[1] : null;
}

function firstMatch(block, re) {
  const m = block.match(re);
  return m ? m[1] : null;
}

export function parseEntry(block, file) {
  const id = firstMatch(block, /<span\s+id="(e\d+)"\s+class="lpLexEntryName">/);
  if (!id) return null;

  const ipa = cleanGloss(firstMatch(block, /<span\s+id="e\d+"\s+class="lpLexEntryName">([^<]*)<\/span>/));
  const deva = cleanGloss(firstMatch(block, /<span\s+class="lpLexEntryNameGA_in_Sript">([^<]*)<\/span>/));
  const en = cleanGloss(firstMatch(block, /<span\s+class="lpGlossEnglish">([^<]*)<\/span>/));
  const hi = cleanGloss(firstMatch(block, /<span\s+class="lpGlossHindi">([^<]*)<\/span>/));
  const cat = cleanGloss(firstMatch(block, /<span\s+class="lpCategory">([^<]*)<\/span>/));
  const audio = extractMainAudio(block);

  const entry = { id, file, ipa };
  if (deva) entry.deva = deva;
  if (en) entry.en = en;
  if (hi) entry.hi = hi;
  if (cat) entry.cat = cat;
  if (audio) entry.audio = audio;
  return entry;
}

// ---------- CLI ----------

function buildIndex(lexiconDir) {
  const files = readdirSync(lexiconDir).filter(f => /^\d{2}\.htm$/.test(f)).sort();
  if (!files.length) {
    throw new Error(`No lexicon/NN.htm files found under ${lexiconDir}`);
  }
  const entries = [];
  for (const file of files) {
    const html = readFileSync(join(lexiconDir, file), 'utf8');
    if (!html.includes('lpLexEntryPara') || !html.includes('lpLexEntryName')) {
      throw new Error(`File ${file} is missing expected Lexique-Pro classes (lpLexEntryPara / lpLexEntryName). The source may have been regenerated by a newer Lexique Pro that changed the markup — update the parser before proceeding.`);
    }
    const blocks = extractEntryBlocks(html);
    for (const block of blocks) {
      const entry = parseEntry(block, file);
      if (entry) entries.push(entry);
    }
  }
  return entries;
}

// Only run the CLI when executed directly (not when imported by tests).
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const here = dirname(fileURLToPath(import.meta.url));
  const repoRoot = join(here, '..');
  const lexiconDir = join(repoRoot, 'lexicon');
  const outPath = join(repoRoot, 'assets', 'search-index.json');
  const entries = buildIndex(lexiconDir);
  writeFileSync(outPath, JSON.stringify(entries), 'utf8');
  process.stdout.write(`Wrote ${entries.length} entries to ${outPath}\n`);
}
```

- [ ] **Step 4: Run the tests. Expect all green.**

Run:

```bash
node --test scripts/tests/build-search-index.test.mjs
```

Expected output (the wording varies by Node version):

```
✔ cleanGloss trims whitespace and trailing punctuation
✔ extractEntryBlocks returns one string per entry paragraph
✔ extractMainAudio finds audio link BEFORE the headword
✔ extractMainAudio ignores audio link AFTER the headword (example audio)
✔ extractMainAudio returns null when there is no audio link at all
✔ parseEntry extracts all fields when present
✔ parseEntry omits audio when no main audio present
✔ parseEntry omits en when no English gloss present
✔ parseEntry strips homonym subscripts from the IPA headword
# tests 9
# pass 9
# fail 0
```

If any fail, fix the implementation and re-run until green.

---

## Task 4: Build the real search index

**Files:**
- Create: `assets/search-index.json` (generated)

- [ ] **Step 1: Run the builder**

Run:

```bash
node scripts/build-search-index.mjs
```

Expected output: `Wrote N entries to .../assets/search-index.json`, where N is roughly 1,000–1,500 (depending on the dictionary).

- [ ] **Step 2: Spot-check the output**

Run:

```bash
node -e "const j=require('fs').readFileSync('assets/search-index.json','utf8'); const a=JSON.parse(j); console.log('count:', a.length); console.log('first:', a[0]); console.log('sample with audio:', a.find(e=>e.audio));"
```

Expected: count > 1000, first entry has `id`, `file`, `ipa` at minimum, and the sample-with-audio shows an `audio: "audio/..."` path.

- [ ] **Step 3: Check the file size**

Run:

```bash
wc -c assets/search-index.json
```

Expected: under 500 KB. If it's much larger, glosses are probably too long — but this is acceptable for v1.

---

## Task 5: Static `index.htm` skeleton

**Files:**
- Modify: `index.htm` (replacing the 7-line redirect)

Before this task, the old `index.htm` redirects to `lexicon/index.htm`. After this task, opening the project loads the new homepage skeleton — visually present but without interactive search yet.

- [ ] **Step 1: Write the new `index.htm`**

Replace the entire contents of `index.htm` with:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>Great Andamanese — Dictionary</title>
  <link rel="stylesheet" href="assets/home.css"/>
</head>
<body>
  <header class="topbar">
    <a class="about-link" href="about.htm">About</a>
  </header>

  <main class="hero">
    <h1 class="brand">Great Andamanese</h1>
    <p class="tagline">A trilingual record of an endangered language</p>

    <form class="search-form" role="search" action="lexicon/index.htm">
      <div class="search-wrap">
        <svg class="search-icon" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
          <circle cx="7" cy="7" r="5" fill="none" stroke="currentColor" stroke-width="1.6"/>
          <line x1="11" y1="11" x2="14" y2="14" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
        </svg>
        <input
          id="q"
          name="q"
          type="search"
          autocomplete="off"
          spellcheck="false"
          placeholder="Search a word in English or IPA…"
          aria-label="Search the dictionary"
        />
        <div id="dropdown" class="dropdown" hidden></div>
      </div>
    </form>

    <nav class="browse" aria-label="Browse the dictionary">
      <a href="lexicon/index.htm">Lexicon</a>
      <span class="sep">·</span>
      <a href="index-ga_in_sript/index.htm">Devanagari index</a>
      <span class="sep">·</span>
      <a href="index-english/index.htm">English index</a>
      <span class="sep">·</span>
      <a href="index-hindi/index.htm">Hindi index</a>
      <span class="sep">·</span>
      <a href="categories/index.htm">Categories</a>
    </nav>

    <section id="wotd" class="wotd" hidden aria-label="Word of the day">
      <!-- populated by home.js -->
    </section>
  </main>

  <script src="assets/home.js" defer></script>
</body>
</html>
```

- [ ] **Step 2: Open in a browser to verify the skeleton**

Open `index.htm` directly (`file://`) or via `python -m http.server 8000` and visit `http://localhost:8000/`.

Expected at this point:
- Page loads — no JS errors in the console.
- You see the brand, tagline, search input, browse links, About link top-right.
- It's unstyled (looks ugly — that's fine, styling lands in Task 6).
- Browse links navigate to the existing frameset pages and they still work.

If browse links don't work, double-check the `href` values match the actual directory names.

---

## Task 6: Stylesheet (`assets/home.css`)

**Files:**
- Create: `assets/home.css`

- [ ] **Step 1: Write the stylesheet**

Create `assets/home.css` with the following content:

```css
:root {
  --paper:        #fbf6ec;
  --paper-2:      #f5ecd9;
  --ink:          #2a1f15;
  --ink-soft:     #5e4a36;
  --ink-mute:     #8a7c66;
  --rule:         #e6dcc4;
  --accent:       #8a5a2b;
  --accent-soft:  #c9a36a;
  --hi:           #fff2cf;

  --serif: Georgia, "Times New Roman", serif;
  --sans:  -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  --mono:  ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}

* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body {
  background: var(--paper);
  color: var(--ink);
  font-family: var(--sans);
  font-size: 16px;
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
}
a { color: var(--accent); text-decoration: none; }
a:hover { text-decoration: underline; }

/* Top bar */
.topbar {
  display: flex;
  justify-content: flex-end;
  padding: 22px 36px;
}
.about-link {
  font-size: 12px;
  letter-spacing: 1.4px;
  text-transform: uppercase;
  color: var(--ink-soft);
}
.about-link:hover { color: var(--accent); text-decoration: none; }

/* Hero */
.hero {
  max-width: 720px;
  margin: 0 auto;
  padding: 40px 24px 80px;
  text-align: center;
}
.brand {
  font-family: var(--serif);
  font-weight: 500;
  font-size: 48px;
  line-height: 1;
  letter-spacing: -1px;
  margin: 0 0 14px;
  color: var(--ink);
}
.tagline {
  font-family: var(--serif);
  font-style: italic;
  font-size: 16px;
  color: var(--ink-soft);
  margin: 0 0 32px;
}

/* Search */
.search-form { margin: 0; }
.search-wrap {
  position: relative;
  max-width: 540px;
  margin: 0 auto;
}
.search-icon {
  position: absolute;
  left: 20px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--accent);
  pointer-events: none;
}
#q {
  width: 100%;
  background: #fff;
  border: 1px solid var(--rule);
  border-radius: 999px;
  padding: 14px 20px 14px 48px;
  font-size: 14px;
  font-family: var(--serif);
  color: var(--ink);
  box-shadow: 0 2px 8px rgba(80, 55, 20, 0.06);
  outline: none;
  transition: border-color .15s, box-shadow .15s;
}
#q::placeholder { color: var(--ink-mute); font-style: italic; }
#q:focus {
  border-color: var(--accent-soft);
  box-shadow: 0 2px 12px rgba(80, 55, 20, 0.10);
}

/* Dropdown */
.dropdown {
  position: absolute;
  left: 0; right: 0; top: calc(100% + 6px);
  background: #fff;
  border: 1px solid var(--rule);
  border-radius: 14px;
  box-shadow: 0 12px 28px rgba(80, 55, 20, 0.12);
  overflow: hidden;
  text-align: left;
  z-index: 10;
}
.dropdown[hidden] { display: none; }
.dropdown .section-label {
  padding: 9px 16px 4px;
  font-size: 9.5px;
  letter-spacing: 1.4px;
  text-transform: uppercase;
  color: var(--ink-mute);
}
.dropdown .row {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px 16px;
  border-top: 1px solid #f3ead4;
  cursor: pointer;
}
.dropdown .row:first-child,
.dropdown .section-label + .row { border-top: none; }
.dropdown .row.active { background: #fdf6e3; }
.dropdown .row .body { flex: 1; min-width: 0; }
.dropdown .row .line1 {
  display: flex;
  align-items: baseline;
  gap: 10px;
  flex-wrap: wrap;
}
.dropdown .row .ipa {
  font-family: var(--serif);
  font-size: 17px;
  font-weight: 500;
  color: var(--ink);
}
.dropdown .row .deva {
  font-size: 13px;
  color: var(--ink-mute);
}
.dropdown .row .line2 {
  margin-top: 2px;
  font-size: 12px;
  color: var(--ink-soft);
}
.dropdown .row .cat {
  display: inline-block;
  font-size: 9.5px;
  letter-spacing: 0.8px;
  text-transform: uppercase;
  color: var(--accent);
  border: 1px solid var(--accent-soft);
  padding: 1px 6px;
  border-radius: 10px;
  margin-right: 8px;
}
.dropdown mark {
  background: var(--hi);
  color: inherit;
  padding: 0 1px;
  border-radius: 2px;
  font-weight: 600;
}
.dropdown .row .audio-btn {
  width: 40px;
  height: 40px;
  min-width: 40px;
  border: 1px solid var(--rule);
  background: var(--paper);
  border-radius: 50%;
  color: var(--accent);
  font-size: 14px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  flex-shrink: 0;
}
.dropdown .footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 9px 16px;
  background: #fdfaf1;
  font-size: 11px;
  color: var(--ink-mute);
  border-top: 1px solid var(--rule);
}
.dropdown .footer .kbd {
  display: inline-block;
  padding: 1px 5px;
  border: 1px solid var(--rule);
  border-radius: 3px;
  font-family: var(--mono);
  font-size: 10px;
  background: #fff;
  color: var(--ink-soft);
}
.dropdown .footer .seeall { color: var(--accent); font-weight: 600; cursor: pointer; }
.dropdown .empty {
  padding: 24px 20px;
  text-align: center;
}
.dropdown .empty .title {
  font-family: var(--serif);
  font-size: 15px;
  color: var(--ink);
  margin-bottom: 6px;
}
.dropdown .empty .sub {
  font-size: 12px;
  color: var(--ink-soft);
}
.dropdown .empty .nudge {
  margin-top: 14px;
  font-size: 12px;
}

/* Browse links */
.browse {
  margin-top: 20px;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px 18px;
  font-size: 13px;
}
.browse a { padding: 4px 2px; }
.browse .sep { color: var(--accent-soft); }

/* Word of the day */
.wotd {
  margin: 40px auto 0;
  max-width: 540px;
  background: #fff;
  border: 1px solid var(--rule);
  border-radius: 12px;
  padding: 18px 22px;
  display: flex;
  align-items: center;
  gap: 18px;
  text-align: left;
  box-shadow: 0 2px 8px rgba(80, 55, 20, 0.04);
  cursor: pointer;
}
.wotd[hidden] { display: none; }
.wotd .body { flex: 1; min-width: 0; }
.wotd .label {
  font-size: 10px;
  letter-spacing: 1.6px;
  text-transform: uppercase;
  color: var(--accent);
}
.wotd .word {
  font-family: var(--serif);
  font-size: 24px;
  color: var(--ink);
  margin: 4px 0 4px;
}
.wotd .gloss {
  font-size: 13px;
  color: var(--ink-soft);
}
.wotd .audio-btn {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: var(--paper);
  border: 1px solid var(--rule);
  color: var(--accent);
  font-size: 14px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  flex-shrink: 0;
}

/* Mobile */
@media (max-width: 640px) {
  .topbar { padding: 16px 18px; }
  .about-link { font-size: 10px; }
  .hero { padding: 24px 18px 60px; }
  .brand { font-size: 26px; letter-spacing: -0.4px; margin-bottom: 8px; }
  .tagline { font-size: 11px; margin-bottom: 20px; }
  #q { font-size: 12px; padding: 10px 14px 10px 36px; }
  .search-icon { left: 12px; }
  .browse {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px 10px;
    font-size: 11px;
    margin-top: 16px;
  }
  .browse .sep { display: none; }
  .browse a {
    padding: 8px 4px;
    border-bottom: 1px solid var(--rule);
    text-align: center;
  }
  .browse a:first-child { grid-column: 1 / -1; }
  .wotd { margin-top: 22px; padding: 14px 16px; }
  .wotd .word { font-size: 18px; }
  .wotd .gloss { font-size: 11px; }
  .dropdown .row .ipa { font-size: 15px; }
}
```

- [ ] **Step 2: Reload `index.htm` in the browser and verify**

Expected:
- Page now has the warm paper background.
- Brand reads in large serif italic-friendly Georgia.
- Search input is a rounded pill with a search icon on the left.
- Browse links are inline, dot-separated, terracotta colored.
- About link sits flush top-right in small caps.
- Resize the browser to ≤640px wide: brand shrinks, browse links become a 2-column grid with "Lexicon" full-width on top.
- No console errors.

---

## Task 7: `home.js` — load index, search, render dropdown

**Files:**
- Create: `assets/home.js`

This task brings the dropdown to life: typing in the input shows results.

- [ ] **Step 1: Write `assets/home.js`**

Create `assets/home.js`:

```javascript
/* Great Andamanese homepage — vanilla JS, no modules. */
(function () {
  'use strict';

  // ---------- Constants ----------
  const INDEX_URL = 'assets/search-index.json';
  const MAX_RESULTS = 6;
  const DEBOUNCE_MS = 80;
  const RECENT_KEY = 'ga.recent';
  const MAX_RECENTS = 5;

  // Hard-coded suggestions for the empty state. Replace these IDs once we know
  // which entries exist in the index (see open question in the spec).
  const SUGGESTED_IDS = ['e13', 'e1279', 'e500']; // refined later in Task 8

  // ---------- State ----------
  let INDEX = null;            // resolved array once loaded
  let pending = null;          // most recent query while index was loading
  let activeIndex = -1;        // highlighted dropdown row (-1 = none)
  let currentResults = [];     // results currently rendered

  // ---------- Pure helpers ----------

  function debounce(fn, ms) {
    let t = null;
    return function () {
      const args = arguments;
      if (t) clearTimeout(t);
      t = setTimeout(() => fn.apply(null, args), ms);
    };
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function highlight(text, query) {
    if (!query) return escapeHtml(text);
    const lower = text.toLowerCase();
    const idx = lower.indexOf(query.toLowerCase());
    if (idx < 0) return escapeHtml(text);
    const before = text.slice(0, idx);
    const match = text.slice(idx, idx + query.length);
    const after = text.slice(idx + query.length);
    return escapeHtml(before) + '<mark>' + escapeHtml(match) + '</mark>' + escapeHtml(after);
  }

  function searchIndex(query, index) {
    const q = query.trim().toLowerCase();
    if (!q || !index) return [];
    const scored = [];
    for (const e of index) {
      let score = 0;
      let field = null;
      if (e.ipa && e.ipa.toLowerCase().startsWith(q))      { score = 100; field = 'ipa'; }
      else if (e.en && e.en.toLowerCase().split(/\s+/).some(w => w.startsWith(q)))
                                                           { score = 80;  field = 'en'; }
      else if (e.ipa && e.ipa.toLowerCase().includes(q))   { score = 50;  field = 'ipa'; }
      else if (e.en && e.en.toLowerCase().includes(q))     { score = 40;  field = 'en'; }
      if (score > 0) scored.push({ entry: e, score, field });
    }
    scored.sort((a, b) => (b.score - a.score) || a.entry.ipa.localeCompare(b.entry.ipa));
    return scored.slice(0, MAX_RESULTS);
  }

  // ---------- Recents ----------

  function recentEntries() {
    try {
      const raw = localStorage.getItem(RECENT_KEY);
      if (!raw) return [];
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    } catch (e) {
      return [];
    }
  }

  function recordRecent(entry) {
    if (!entry) return;
    const slim = { id: entry.id, file: entry.file, ipa: entry.ipa, en: entry.en, deva: entry.deva };
    const list = recentEntries().filter(e => e.id !== slim.id);
    list.unshift(slim);
    while (list.length > MAX_RECENTS) list.pop();
    try { localStorage.setItem(RECENT_KEY, JSON.stringify(list)); } catch (e) { /* ignore quota */ }
  }

  // ---------- Rendering ----------

  function entryUrl(entry) {
    return 'lexicon/' + entry.file + '#' + entry.id;
  }

  function audioUrl(entry) {
    // Encode spaces in filenames the way Lexique Pro does.
    return entry.audio ? entry.audio.replace(/ /g, '%20') : null;
  }

  function rowHtml(entry, query, matchField, isActive) {
    const ipaHtml  = matchField === 'ipa' ? highlight(entry.ipa, query) : escapeHtml(entry.ipa);
    const enHtml   = entry.en
      ? (matchField === 'en' ? highlight(entry.en, query) : escapeHtml(entry.en))
      : '';
    const devaHtml = entry.deva ? escapeHtml(entry.deva) : '';
    const hiHtml   = entry.hi   ? escapeHtml(entry.hi)   : '';
    const catHtml  = entry.cat  ? '<span class="cat">' + escapeHtml(entry.cat) + '</span>' : '';
    const gloss = [enHtml, hiHtml].filter(Boolean).join(' · ');
    const audioBtn = entry.audio
      ? '<button class="audio-btn" type="button" data-audio="' + escapeHtml(audioUrl(entry)) + '" aria-label="Play audio">▶</button>'
      : '';
    return (
      '<div class="row' + (isActive ? ' active' : '') + '" role="option" data-href="' + escapeHtml(entryUrl(entry)) + '" data-id="' + escapeHtml(entry.id) + '">' +
        '<div class="body">' +
          '<div class="line1"><span class="ipa">' + ipaHtml + '</span>' +
            (devaHtml ? '<span class="deva">' + devaHtml + '</span>' : '') +
          '</div>' +
          '<div class="line2">' + catHtml + gloss + '</div>' +
        '</div>' +
        audioBtn +
      '</div>'
    );
  }

  function footerHtml(totalShown) {
    return (
      '<div class="footer">' +
        '<span><span class="kbd">↑↓</span> navigate &nbsp; <span class="kbd">↵</span> open</span>' +
        '<span class="seeall" data-seeall="1">See all ' + totalShown + ' results →</span>' +
      '</div>'
    );
  }

  function noResultsHtml(query) {
    return (
      '<div class="empty">' +
        '<div class="title">No matches for "' + escapeHtml(query) + '"</div>' +
        '<div class="sub">Try a shorter prefix, or check spelling.</div>' +
        '<div class="nudge"><a href="lexicon/index.htm">Browse by letter →</a></div>' +
      '</div>'
    );
  }

  function renderDropdown(results, query) {
    const dd = document.getElementById('dropdown');
    if (!results.length) {
      dd.innerHTML = noResultsHtml(query);
      dd.hidden = false;
      return;
    }
    activeIndex = 0;
    currentResults = results;
    const rows = results
      .map((r, i) => rowHtml(r.entry, query, r.field, i === activeIndex))
      .join('');
    dd.innerHTML = rows + footerHtml(results.length);
    dd.hidden = false;
  }

  function hideDropdown() {
    const dd = document.getElementById('dropdown');
    dd.hidden = true;
    dd.innerHTML = '';
    activeIndex = -1;
    currentResults = [];
  }

  function setActive(newIndex) {
    activeIndex = newIndex;
    const dd = document.getElementById('dropdown');
    const rows = dd.querySelectorAll('.row');
    rows.forEach((row, i) => {
      row.classList.toggle('active', i === activeIndex);
    });
  }

  // ---------- Loading ----------

  function loadIndex() {
    return fetch(INDEX_URL)
      .then(r => r.json())
      .then(json => { INDEX = json; })
      .catch(err => { console.error('Failed to load search index:', err); INDEX = []; });
  }

  // ---------- Wiring ----------

  function onInput() {
    const q = document.getElementById('q').value;
    if (!q.trim()) { hideDropdown(); return; }
    if (!INDEX) { pending = q; return; }
    const results = searchIndex(q, INDEX);
    renderDropdown(results, q);
  }

  function openActive() {
    if (activeIndex < 0 || activeIndex >= currentResults.length) return;
    const entry = currentResults[activeIndex].entry;
    recordRecent(entry);
    window.location.href = entryUrl(entry);
  }

  function onKeyDown(e) {
    if (document.getElementById('dropdown').hidden) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (currentResults.length === 0) return;
      setActive((activeIndex + 1) % currentResults.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (currentResults.length === 0) return;
      setActive((activeIndex - 1 + currentResults.length) % currentResults.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      openActive();
    } else if (e.key === 'Escape') {
      if (activeIndex >= 0) { setActive(-1); }
      else { document.getElementById('q').blur(); hideDropdown(); }
    }
  }

  function onDropdownClick(e) {
    const audioBtn = e.target.closest('.audio-btn');
    if (audioBtn) {
      e.preventDefault();
      e.stopPropagation();
      playAudio(audioBtn.getAttribute('data-audio'));
      return;
    }
    const seeAll = e.target.closest('[data-seeall]');
    if (seeAll) {
      e.preventDefault();
      if (currentResults.length) {
        const entry = currentResults[0].entry;
        recordRecent(entry);
        window.location.href = entryUrl(entry);
      }
      return;
    }
    const row = e.target.closest('.row');
    if (row) {
      const href = row.getAttribute('data-href');
      const id = row.getAttribute('data-id');
      const entry = (currentResults.find(r => r.entry.id === id) || {}).entry;
      if (entry) recordRecent(entry);
      window.location.href = href;
    }
  }

  function onDocumentClick(e) {
    if (e.target.closest('.search-wrap')) return;
    hideDropdown();
  }

  function playAudio(url) {
    if (!url) return;
    try {
      const a = new Audio(url);
      a.play().catch(err => console.warn('Audio playback failed:', err));
    } catch (err) {
      console.warn('Audio constructor failed:', err);
    }
  }

  // ---------- Bootstrap ----------

  function bindSearchBox() {
    const input = document.getElementById('q');
    const debounced = debounce(onInput, DEBOUNCE_MS);
    input.addEventListener('input', debounced);
    input.addEventListener('keydown', onKeyDown);
    document.getElementById('dropdown').addEventListener('click', onDropdownClick);
    document.addEventListener('click', onDocumentClick);
  }

  function init() {
    bindSearchBox();
    loadIndex().then(() => {
      if (pending && pending === document.getElementById('q').value) {
        onInput();
      }
      pending = null;
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
```

- [ ] **Step 2: Reload `index.htm` and type "wat"**

Expected:
- After typing 3 characters, a dropdown appears below the search box with matching entries.
- The matched substring "wat" is highlighted in the English glosses.
- Hovering rows does nothing yet visually (highlight is only on the active row).
- ↓ / ↑ moves the active highlight.
- Enter navigates to the active entry's `lexicon/NN.htm#eN`.
- Clicking a row navigates the same way.
- Clicking outside the search hides the dropdown.

If results don't appear: open the browser DevTools, check for fetch errors on `assets/search-index.json`. Make sure you ran Task 4 to generate the file.

- [ ] **Step 3: Test the IPA-input path**

Type "ɛr" (use copy-paste — ɛ is U+025B).

Expected:
- Results show GA headwords starting with "ɛr", with "ɛr" highlighted on the IPA word.

- [ ] **Step 4: Test the no-results state**

Type "xyzzy".

Expected:
- Dropdown shows "No matches for 'xyzzy'" with the "Browse by letter →" link.

- [ ] **Step 5: Test audio playback**

Click the play button (▶) on any row that has one.

Expected:
- The `.wav` plays through the page (no popup window).
- The dropdown does NOT navigate. The audio button's click stays local.

If audio doesn't play, check the browser console — see the "Notes for the implementer" at the end of this plan for the legacy plugin caveat.

---

## Task 8: Empty-state recents and suggestions

**Files:**
- Modify: `assets/home.js` (extend, do not replace)

When the search input has focus but is empty, show recent entries + a few suggestions.

- [ ] **Step 1: Pick three suggested entry IDs from the real index**

Run:

```bash
node -e "const a=JSON.parse(require('fs').readFileSync('assets/search-index.json','utf8')); const picks=['water','forest','sun','sea','child'].map(w=>a.find(e=>e.en&&e.en.toLowerCase().includes(w))).filter(Boolean).slice(0,3); console.log(picks.map(p=>({id:p.id,ipa:p.ipa,en:p.en})));"
```

Expected: prints an array of three entries whose English glosses contain common words. Note their IDs.

If fewer than three found, pick any three with `audio` and an English gloss:

```bash
node -e "const a=JSON.parse(require('fs').readFileSync('assets/search-index.json','utf8')); console.log(a.filter(e=>e.audio&&e.en).slice(0,3).map(e=>({id:e.id,ipa:e.ipa,en:e.en})));"
```

- [ ] **Step 2: Update `SUGGESTED_IDS` in `home.js`**

Open `assets/home.js`. Find the line:

```javascript
const SUGGESTED_IDS = ['e13', 'e1279', 'e500']; // refined later in Task 9
```

Replace the array with the three IDs from Step 1. Drop the trailing comment.

- [ ] **Step 3: Add the empty-state renderer and wire focus**

In `assets/home.js`, **add** the following helper above `function bindSearchBox()`:

```javascript
  function suggestionEntries() {
    if (!INDEX) return [];
    return SUGGESTED_IDS
      .map(id => INDEX.find(e => e.id === id))
      .filter(Boolean);
  }

  function emptyStateHtml() {
    const recents = recentEntries();
    const suggestions = suggestionEntries();
    if (!recents.length && !suggestions.length) return '';
    let html = '';
    if (recents.length) {
      html += '<div class="section-label">Recent</div>';
      for (const e of recents) {
        currentResults.push({ entry: e, field: null });
        html += rowHtml(e, '', null, false);
      }
    }
    if (suggestions.length) {
      html += '<div class="section-label">Try</div>';
      for (const e of suggestions) {
        currentResults.push({ entry: e, field: null });
        html += rowHtml(e, '', null, false);
      }
    }
    return html;
  }

  function renderEmptyState() {
    const dd = document.getElementById('dropdown');
    currentResults = [];
    activeIndex = -1;
    const html = emptyStateHtml();
    if (!html) { hideDropdown(); return; }
    dd.innerHTML = html;
    dd.hidden = false;
  }
```

Then **modify `onInput`** to call `renderEmptyState` when the query is empty:

```javascript
  function onInput() {
    const q = document.getElementById('q').value;
    if (!q.trim()) { renderEmptyState(); return; }
    if (!INDEX) { pending = q; return; }
    const results = searchIndex(q, INDEX);
    renderDropdown(results, q);
  }
```

And **modify `bindSearchBox`** to render the empty state on focus:

```javascript
  function bindSearchBox() {
    const input = document.getElementById('q');
    const debounced = debounce(onInput, DEBOUNCE_MS);
    input.addEventListener('input', debounced);
    input.addEventListener('keydown', onKeyDown);
    input.addEventListener('focus', function () {
      if (!input.value.trim()) renderEmptyState();
    });
    document.getElementById('dropdown').addEventListener('click', onDropdownClick);
    document.addEventListener('click', onDocumentClick);
  }
```

- [ ] **Step 4: Verify**

Reload `index.htm`. Click into the empty search box.

Expected:
- Dropdown appears with "Try" section listing the three suggestions.
- After clicking a result then returning to the homepage, the search box now shows "Recent" with that entry on top of "Try".
- Clicking a recent or a suggestion navigates to its entry page.

---

## Task 9: Word of the Day card

**Files:**
- Modify: `assets/home.js` (extend, do not replace)

- [ ] **Step 1: Add the deterministic picker and renderer**

In `assets/home.js`, **add** these functions above `function init()`:

```javascript
  function fnv1a32(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
    }
    return h >>> 0;
  }

  function isoDateToday() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function wordOfTheDay(index, dateStr) {
    if (!index || !index.length) return null;
    let pool = index.filter(e => e.en && e.audio);
    if (!pool.length) pool = index.filter(e => e.en);
    if (!pool.length) return null;
    const h = fnv1a32(dateStr);
    return pool[h % pool.length];
  }

  function renderWordOfTheDay() {
    const entry = wordOfTheDay(INDEX, isoDateToday());
    if (!entry) return;
    const el = document.getElementById('wotd');
    const gloss = [entry.en, entry.hi].filter(Boolean).join(' · ');
    const audio = entry.audio
      ? '<button class="audio-btn" type="button" data-audio="' + escapeHtml(audioUrl(entry)) + '" aria-label="Play audio">▶</button>'
      : '';
    el.innerHTML =
      '<div class="body">' +
        '<div class="label">Word of the day</div>' +
        '<div class="word">' + escapeHtml(entry.ipa) + '</div>' +
        '<div class="gloss">' + escapeHtml(gloss) + '</div>' +
      '</div>' +
      audio;
    el.setAttribute('data-href', entryUrl(entry));
    el.setAttribute('data-id', entry.id);
    el.hidden = false;
  }

  function onWotdClick(e) {
    const audioBtn = e.target.closest('.audio-btn');
    if (audioBtn) {
      e.preventDefault();
      e.stopPropagation();
      playAudio(audioBtn.getAttribute('data-audio'));
      return;
    }
    const el = document.getElementById('wotd');
    const href = el.getAttribute('data-href');
    const id = el.getAttribute('data-id');
    if (!href) return;
    const entry = (INDEX || []).find(x => x.id === id);
    if (entry) recordRecent(entry);
    window.location.href = href;
  }
```

- [ ] **Step 2: Wire it from `init`**

Change `init()` so it renders the WOTD after the index loads:

```javascript
  function init() {
    bindSearchBox();
    document.getElementById('wotd').addEventListener('click', onWotdClick);
    loadIndex().then(() => {
      if (pending && pending === document.getElementById('q').value) {
        onInput();
      }
      pending = null;
      renderWordOfTheDay();
    });
  }
```

- [ ] **Step 3: Verify**

Reload `index.htm`.

Expected:
- After a brief moment (index loads), a Word of the Day card appears below the browse links.
- It shows an IPA word, glosses, and a play button.
- Reloading the page on the same day shows the same word.
- Clicking the audio button plays the sound and does not navigate.
- Clicking elsewhere on the card navigates to the entry's lexicon page.

- [ ] **Step 4: Verify the deterministic-by-date behavior**

Open DevTools console and run:

```javascript
const idx = await fetch('assets/search-index.json').then(r => r.json());
const fn = (() => {
  function fnv1a32(s){let h=0x811c9dc5;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=(h+((h<<1)+(h<<4)+(h<<7)+(h<<8)+(h<<24)))>>>0;}return h>>>0;}
  return d => { let p = idx.filter(e=>e.en&&e.audio); return p[fnv1a32(d) % p.length]; };
})();
console.log('today:', fn('2026-05-23'));
console.log('tomorrow:', fn('2026-05-24'));
```

Expected: two different entries.

---

## Task 10: About page

**Files:**
- Create: `about.htm`

- [ ] **Step 1: Write `about.htm`**

Create `about.htm` at the repo root:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>About — Great Andamanese Dictionary</title>
  <link rel="stylesheet" href="assets/home.css"/>
  <style>
    .about {
      max-width: 640px;
      margin: 0 auto;
      padding: 40px 24px 80px;
    }
    .about h1 {
      font-family: var(--serif);
      font-weight: 500;
      font-size: 32px;
      letter-spacing: -0.5px;
      margin: 0 0 18px;
    }
    .about p { font-size: 15px; color: var(--ink-soft); line-height: 1.65; margin: 0 0 14px; }
    .about a { color: var(--accent); }
    .about .back { display: inline-block; margin-top: 18px; font-size: 13px; }
    @media (max-width: 640px) {
      .about { padding: 24px 18px 60px; }
      .about h1 { font-size: 22px; }
      .about p { font-size: 13px; }
    }
  </style>
</head>
<body>
  <header class="topbar">
    <a class="about-link" href="index.htm">Home</a>
  </header>
  <main class="about">
    <h1>About this dictionary</h1>
    <p>This is a trilingual dictionary of <strong>Great Andamanese</strong>, an endangered language of the Andaman Islands. Entries are recorded in Great Andamanese (in IPA and in Devanagari), with English and Hindi glosses, audio pronunciations, and pictures.</p>
    <p>The dictionary was originally compiled and exported as a static website using Lexique Pro 3.6 on 16 January 2018. This modern homepage was added to make the dictionary searchable and mobile-friendly; the underlying entry pages remain as they were generated.</p>
    <p>Audio recordings were contributed by speakers of the language. Some browsers may prompt before playing audio; if playback fails, the original entry page still links to the source <code>.wav</code> file directly.</p>
    <p>This is a preservation project, not a commercial product. If you have corrections, additions, or recordings to contribute, please reach out to the maintainers.</p>
    <a class="back" href="index.htm">← Back to search</a>
  </main>
</body>
</html>
```

- [ ] **Step 2: Verify**

Reload the homepage and click "About" in the top-right corner.

Expected:
- `about.htm` opens in the same visual language as the homepage.
- Layout looks reasonable both desktop and mobile.
- "← Back to search" link returns to `index.htm`.
- The "Home" link in the top-right also returns to `index.htm`.

---

## Task 11: Manual verification pass

**Files:** none

Run through every item from the spec's Testing section. Mark each check below as you confirm it.

- [ ] **Check 1:** Open `index.htm` directly via `file://`. Page loads; no console errors; the search index loads.

- [ ] **Check 2:** Serve via `python -m http.server 8000` from the repo root; visit `http://localhost:8000/`. Same page, no errors.

- [ ] **Check 3:** Type `wat`. At least three English-gloss matches appear; `wat` is highlighted in the glosses.

- [ ] **Check 4:** Type `ɛr` (copy-paste). At least one IPA match appears with `ɛr` highlighted in the GA headword.

- [ ] **Check 5:** Click an autocomplete row. Browser navigates to `lexicon/NN.htm#eN`. The Lexique Pro page loads and the linked entry is highlighted (via the existing `hi.js`).

- [ ] **Check 6:** Click an autocomplete audio button. Audio plays. The row does NOT navigate.

- [ ] **Check 7:** Press `↑` / `↓` to move the active row, then `Enter`. Browser navigates to the active entry.

- [ ] **Check 8:** Press `Escape` once. Active highlight clears. Press `Escape` again. Dropdown closes, input loses focus.

- [ ] **Check 9:** Resize the browser to ≤360px wide. Layout stacks correctly; brand shrinks; browse links form a 2-column grid; WOTD card is full-width.

- [ ] **Check 10:** Open the homepage twice on the same calendar day. WOTD is the same word.

- [ ] **Check 11:** Use DevTools to override `Date.now()` (or just shift the system date) to a different day. Reload. WOTD is a different word.

- [ ] **Check 12:** Click each browse link. Each lands on the existing index/frameset page with no broken styling.

- [ ] **Check 13:** Click "About". `about.htm` opens. Clicking "Home" returns to the new homepage. Clicking "Back to search" also returns.

- [ ] **Check 14:** Open the homepage in a fresh incognito window — confirm there is no `ga.recent` in localStorage initially. Empty-state shows only "Try". Click a row to open an entry, then go back: empty-state now shows "Recent" containing that entry above "Try".

- [ ] **Check 15:** Confirm the file `audio/<the WOTD's audio>` loads from the page (DevTools Network tab shows a 200 when the play button is clicked).

If any check fails, fix the relevant code and re-verify. Do not call the task done with an outstanding failure.

---

## Notes for the implementer

- **Audio plugin caveat:** The existing site uses a legacy Windows-Media-Player popup (`javascript/BatmoAudioPop.js`). Modern browsers play these `.wav` files through the HTML5 `<audio>` element natively. Per the project's memory, audio playback in modern browsers is already known to work. If you find audio fails in your browser, log a console warning but do not attempt a popup-style fallback in v1 — the spec marks that as future work.

- **Re-running the builder:** Whenever the Lexique Pro source is re-exported, re-run `node scripts/build-search-index.mjs` to regenerate the index, then commit the new `assets/search-index.json` if applicable.

- **What is NOT touched:** every file under `lexicon/`, `index-english/`, `index-hindi/`, `index-ga_in_sript/`, `categories/`, `javascript/`, `stylesheets/`, and `title.htm`. The legacy frameset experience must remain pixel-identical to today.

- **The deferred IIFE choice:** `home.js` is a single self-invoking function. Pure helpers (`searchIndex`, `wordOfTheDay`, `fnv1a32`, `cleanGloss`-equivalents) are not exported for browser tests. If you decide future versions need automated frontend tests, the cleanest move is to convert `home.js` to a native ES module (`<script type="module">`) and export the pure functions. Don't do that retrofit in v1.
