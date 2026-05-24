# Dictionary Entry Card Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the legacy paragraph-rendered dictionary entry pages (`lexicon/*.htm`, `categories/c*.htm`) into a card-style layout via a client-side DOM transformer, without modifying any of the HTML content.

**Architecture:** A new `assets/cards.js` runs on `DOMContentLoaded`, walks each `<p class="lpLexEntryPara">`, parses fields by class name, and replaces the paragraph with a structured card DOM. A new `assets/cards.css` styles the cards. A one-shot `scripts/inject-card-includes.mjs` Node script adds the `<link>` and `<script>` tags to every entry HTML file. The legacy `javascript/hi.js` fragment-highlighter continues to work because the new card carries the original `id="eN"`.

**Tech Stack:** Vanilla browser JS (single IIFE, no modules), CSS3 (custom properties already declared in `lexiquepro.css`), Node.js ≥18 for the one-shot HTML rewrite (zero npm dependencies — built-in `fs` only).

**Environment notes:**
- The project IS a git repository. Commit at logical checkpoints; do not push.
- The Lexique Pro authoring tool is retired, so editing the generated `lexicon/*.htm` and `categories/c*.htm` files is safe.
- No automated tests for the browser-side code (project has no frontend test framework). Manual verification per the spec's checklist is the verification mechanism.
- The parser is keyed off CSS class names already in the source (`lpLexEntryName`, `lpGlossEnglish`, etc.). These are stable in this corpus — Lexique Pro is retired, no future regen will rename them.

---

## File structure

```
assets/cards.css                          # CREATE — card layout + lightbox styles
assets/cards.js                           # CREATE — DOM transformer + lightbox
scripts/inject-card-includes.mjs          # CREATE — one-shot HTML rewrite script
lexicon/01.htm – lexicon/35.htm           # MODIFY — 2 lines added to <head>
categories/c001.htm – categories/c124.htm # MODIFY — 2 lines added to <head>
docs/superpowers/specs/2026-05-23-entry-card-layout-design.md  # already exists
```

Responsibilities:

- `assets/cards.css` — every visual rule for the new card structure, including the lightbox overlay and mobile breakpoint. Doesn't touch the legacy `lp*` class rules (those still live in `stylesheets/lexiquepro.css` for the JS-disabled fallback case).
- `assets/cards.js` — one IIFE, organised as small functions: `parseEntry`, `renderCard`, `findAudioBefore`, `transformPage`, `installAudioHandler`, `installLightbox`, `openLightbox`, `closeLightbox`, `maybeRenderHeader`, `init`. Single global side effect: replaces matching paragraphs with card divs.
- `scripts/inject-card-includes.mjs` — idempotent script that adds the two new tags to every entry file's `<head>`. Re-runs are safe (no-ops on already-modified files).

Note: sub-entries (`lpLexSubEntryPara`) do **not** appear in this corpus (verified with grep), so the parser does not handle them.

---

## Task 1: Create `assets/cards.css`

**Files:**
- Create: `assets/cards.css`

- [ ] **Step 1: Write the stylesheet**

Create `assets/cards.css` with this exact content:

```css
/* assets/cards.css — card-style rendering of dictionary entries.
   Loaded alongside (after) stylesheets/lexiquepro.css. Targets the new
   .entry/.cards-page class structure produced by cards.js — it does not
   touch the legacy .lp* paragraph rules, so when JS fails to run the page
   falls back gracefully to the paragraph view styled by lexiquepro.css. */

/* Tokens — redeclared so cards.css is independent of stylesheet load order */
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
}

.cards-page {
  max-width: 900px;
  margin: 0 auto;
  padding: 20px 24px 60px;
  font-family: var(--sans);
  color: var(--ink);
}

/* Standalone-context top bar */
.cards-topbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 14px;
  border-bottom: 1px solid var(--rule);
  margin-bottom: 18px;
  font-family: var(--serif);
  font-size: 15px;
}
.cards-topbar a {
  color: var(--accent);
  text-decoration: none;
}
.cards-topbar a:hover { text-decoration: underline; }

/* Card */
.entry {
  background: #fff;
  border: 1px solid var(--rule);
  border-radius: 10px;
  padding: 14px 16px;
  margin-bottom: 10px;
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 14px;
}
.entry.fragment {
  background: var(--hi);
  border-color: var(--accent-soft);
}
.entry .body { min-width: 0; }
.entry .head {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 4px;
}
.entry .ipa {
  font-family: var(--serif);
  font-size: 20px;
  color: var(--accent);
  font-weight: 500;
}
.entry .hom {
  font-size: 12px;
  vertical-align: super;
  color: var(--accent);
  margin-left: -6px;
}
.entry .deva {
  font-family: var(--serif);
  font-size: 13px;
  color: var(--ink-mute);
}
.entry .pos {
  font-size: 9px;
  letter-spacing: 1.2px;
  text-transform: uppercase;
  color: var(--ink-mute);
}
.entry .audio-btn {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: var(--paper);
  border: 1px solid var(--rule);
  color: var(--accent);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  cursor: pointer;
  padding: 0;
  margin-left: auto;
}
.entry .gloss {
  font-size: 13px;
  color: var(--ink);
  margin-top: 2px;
}
.entry .gloss-hi {
  font-size: 12px;
  color: var(--ink-soft);
  margin-top: 1px;
}
.entry .meta-line {
  margin-top: 6px;
  font-size: 11px;
  color: var(--ink-soft);
  display: flex;
  flex-wrap: wrap;
  gap: 4px 10px;
  align-items: baseline;
}
.entry .meta-line .lbl {
  font-size: 9px;
  letter-spacing: 1.2px;
  text-transform: uppercase;
  color: var(--ink-mute);
}
.entry .meta-line .var,
.entry .meta-line .morph,
.entry .meta-line .etym {
  font-family: var(--serif);
  color: var(--ink-soft);
}
.entry .cats {
  margin-top: 6px;
  display: flex;
  gap: 5px;
  flex-wrap: wrap;
}
.entry .cat {
  font-size: 9px;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  color: var(--accent);
  border: 1px solid var(--accent-soft);
  padding: 1px 7px;
  border-radius: 10px;
}
.entry .example {
  margin-top: 8px;
  padding: 8px 10px;
  background: rgba(230, 220, 196, 0.18);
  border-left: 2px solid var(--accent-soft);
  border-radius: 0 6px 6px 0;
}
.entry .example .lbl {
  font-size: 8px;
  letter-spacing: 1.2px;
  text-transform: uppercase;
  color: var(--accent);
  margin-bottom: 3px;
}
.entry .example .ex-ipa {
  font-family: var(--serif);
  font-size: 13px;
  color: var(--ink);
}
.entry .example .ex-deva {
  font-family: var(--serif);
  font-size: 11px;
  color: var(--ink-mute);
  margin-left: 6px;
}
.entry .example .ex-audio {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--paper);
  border: 1px solid var(--rule);
  color: var(--accent);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 9px;
  margin-left: 6px;
  vertical-align: middle;
  cursor: pointer;
  padding: 0;
}
.entry .example .ex-gloss {
  font-size: 11px;
  color: var(--ink-soft);
  margin-top: 2px;
}
.entry .note {
  margin-top: 6px;
  font-size: 11px;
  color: var(--ink-soft);
  font-style: italic;
  padding-left: 8px;
  border-left: 2px solid var(--rule);
}
.entry .refs {
  margin-top: 8px;
  font-size: 11px;
}
.entry .refs .lbl {
  font-size: 8px;
  letter-spacing: 1.2px;
  text-transform: uppercase;
  color: var(--ink-mute);
  display: block;
  margin-bottom: 2px;
}
.entry .ref {
  color: var(--accent);
  margin-right: 12px;
  text-decoration: none;
}
.entry .ref:hover { text-decoration: underline; }
.entry .ref .ref-gloss {
  color: var(--ink-mute);
  font-size: 10px;
  margin-left: 2px;
}

/* Picture thumbnail */
.entry .pic {
  width: 120px;
  height: 120px;
  border-radius: 8px;
  overflow: hidden;
  background-size: cover;
  background-position: center;
  background-color: var(--paper-2);
  cursor: zoom-in;
  flex-shrink: 0;
  align-self: start;
  border: 1px solid var(--rule);
}

/* Lightbox */
.lightbox {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}
.lightbox img {
  max-width: 92vw;
  max-height: 92vh;
  display: block;
}
.lightbox .close {
  position: absolute;
  top: 16px;
  right: 20px;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.15);
  color: #fff;
  border: none;
  font-size: 22px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
}
.lightbox .close:hover { background: rgba(255, 255, 255, 0.25); }

/* Mobile */
@media (max-width: 640px) {
  .cards-page { padding: 14px 14px 50px; }
  .entry {
    grid-template-columns: 1fr;
    padding: 12px 14px;
  }
  .entry .pic {
    width: 100%;
    height: 130px;
    order: 2;
  }
  .entry .body { order: 1; }
  .entry .ipa { font-size: 17px; }
  .entry .deva { font-size: 11px; }
  .entry .gloss { font-size: 12px; }
  .entry .gloss-hi { font-size: 11px; }
}
```

- [ ] **Step 2: Verify file exists and is non-empty**

Run:

```bash
wc -l assets/cards.css
```

Expected: around 220–250 lines.

---

## Task 2: Create `assets/cards.js`

**Files:**
- Create: `assets/cards.js`

- [ ] **Step 1: Write the transformer**

Create `assets/cards.js` with this exact content:

```javascript
/* assets/cards.js — transform <p class="lpLexEntryPara"> paragraphs into
   structured card DOM. Single IIFE; no modules. Runs on DOMContentLoaded.
   Coexists with javascript/hi.js (fragment highlight on window.onload). */
(function () {
  'use strict';

  // ---------- Audio helpers ----------

  function isAudioAnchor(node) {
    if (!node || node.nodeType !== 1 || node.tagName !== 'A') return false;
    const href = node.getAttribute('href') || '';
    return /\/audio\//.test(href) || /^audio\//.test(href);
  }

  function findAudioBefore(paragraph, anchorEl) {
    // Walk paragraph children up to anchorEl; return the last audio href found.
    let audio = null;
    for (const node of paragraph.childNodes) {
      if (node === anchorEl) break;
      if (isAudioAnchor(node)) audio = node.getAttribute('href');
    }
    return audio;
  }

  // ---------- Text cleanup ----------

  function cleanText(s) {
    if (!s) return null;
    const t = s.replace(/[\s;.,]+$/, '').trim();
    return t.length ? t : null;
  }

  // ---------- Entry parsing ----------

  function parseEntry(p) {
    const headSpan = p.querySelector('span.lpLexEntryName');
    if (!headSpan) return null;

    const entry = {
      id: headSpan.id || null,
      ipa: headSpan.textContent.trim(),
      hom: null,
      deva: null,
      morph: null,
      varText: null,
      etym: null,
      pos: null,
      glossEn: null,
      glossHi: null,
      audioMain: findAudioBefore(p, headSpan),
      examples: [],
      categories: [],
      note: null,
      refs: [],
    };

    // Homonym subscript appears as <sub> after the headword span.
    const subAfter = headSpan.nextElementSibling;
    if (subAfter && subAfter.tagName === 'SUB') {
      entry.hom = subAfter.textContent.trim();
    }

    const devaSpan = p.querySelector('span.lpLexEntryNameGA_in_Sript');
    if (devaSpan) entry.deva = devaSpan.textContent.trim();

    const morphSpan = p.querySelector('span.lpMorph');
    if (morphSpan) entry.morph = morphSpan.textContent.trim();

    const etymSpan = p.querySelector('span.lpEtymology');
    if (etymSpan) entry.etym = etymSpan.textContent.trim();

    const varSpan = p.querySelector('span.lpMainCrossRef');
    if (varSpan) entry.varText = varSpan.textContent.trim();

    const posSpan = p.querySelector('span.lpPartOfSpeech');
    if (posSpan) entry.pos = posSpan.textContent.trim().replace(/[.\s]+$/, '');

    // Linear walk over element children to capture main glosses, examples,
    // categories, refs, and notes. State machine driven by mini-heading text.
    const kids = Array.from(p.children);
    let mode = 'main';
    let currentExample = null;

    for (const node of kids) {
      const cls = node.classList;
      const text = node.textContent || '';

      // Mini-heading triggers section transitions
      if (cls && cls.contains('lpMiniHeading')) {
        const lbl = text.trim().replace(/[:.\s]+$/, '');
        if (lbl === 'SD') { mode = 'categories'; continue; }
        if (lbl === 'SEE') { mode = 'refs'; continue; }
        if (lbl === 'NT') { mode = 'notes'; continue; }
        continue; // MORPH/VAR/Etym already captured via querySelector
      }

      if (cls && cls.contains('lpExample')) {
        currentExample = {
          ipa: text.trim(),
          deva: null,
          glossEn: null,
          glossHi: null,
          audio: findAudioBefore(p, node),
        };
        entry.examples.push(currentExample);
        mode = 'inExample';
        continue;
      }

      if (mode === 'main') {
        if (cls && cls.contains('lpGlossEnglish') && !entry.glossEn) {
          entry.glossEn = cleanText(text);
        } else if (cls && cls.contains('lpGlossHindi') && !entry.glossHi) {
          entry.glossHi = cleanText(text);
        }
      } else if (mode === 'inExample' && currentExample) {
        if (cls && cls.contains('lpGlossGA_in_Sript') && !currentExample.deva) {
          currentExample.deva = text.trim();
        } else if (cls && cls.contains('lpGlossEnglish') && !currentExample.glossEn) {
          currentExample.glossEn = cleanText(text);
        } else if (cls && cls.contains('lpGlossHindi') && !currentExample.glossHi) {
          currentExample.glossHi = cleanText(text);
        }
      } else if (mode === 'categories') {
        if (cls && cls.contains('lpCategory')) {
          entry.categories.push(text.trim());
        }
      } else if (mode === 'refs') {
        if (node.tagName === 'A') {
          const refSpan = node.querySelector('span.lpCrossRef');
          if (refSpan) {
            const title = node.getAttribute('title') || '';
            entry.refs.push({
              href: node.getAttribute('href'),
              ipa: refSpan.textContent.trim(),
              gloss: cleanText(title.split(';')[0]) || null,
            });
          }
        }
      } else if (mode === 'notes') {
        if (cls && cls.contains('lpEncycInfoEnglish') && !entry.note) {
          entry.note = cleanText(text.replace(/^NT:\s*/, ''));
        }
      }
    }

    return entry;
  }

  // ---------- Rendering ----------

  function el(tag, className, text) {
    const e = document.createElement(tag);
    if (className) e.className = className;
    if (text != null) e.textContent = text;
    return e;
  }

  function renderCard(entry, pictureSrc) {
    const card = el('article', 'entry');
    if (entry.id) card.id = entry.id;

    const body = el('div', 'body');

    // Head
    const head = el('div', 'head');
    head.appendChild(el('span', 'ipa', entry.ipa));
    if (entry.hom) head.appendChild(el('span', 'hom', entry.hom));
    if (entry.deva) head.appendChild(el('span', 'deva', entry.deva));
    if (entry.pos) head.appendChild(el('span', 'pos', entry.pos));
    if (entry.audioMain) {
      const btn = el('button', 'audio-btn', '▶');
      btn.type = 'button';
      btn.setAttribute('aria-label', 'Play pronunciation');
      btn.dataset.audio = entry.audioMain;
      head.appendChild(btn);
    }
    body.appendChild(head);

    if (entry.glossEn) body.appendChild(el('div', 'gloss', entry.glossEn));
    if (entry.glossHi) body.appendChild(el('div', 'gloss-hi', entry.glossHi));

    // Meta line
    const metaItems = [];
    if (entry.morph)   metaItems.push(['Morph',   entry.morph,   'morph']);
    if (entry.varText) metaItems.push(['Variant', entry.varText, 'var']);
    if (entry.etym)    metaItems.push(['Etym',    entry.etym,    'etym']);
    if (metaItems.length) {
      const meta = el('div', 'meta-line');
      for (const [lbl, val, cls] of metaItems) {
        meta.appendChild(el('span', 'lbl', lbl));
        meta.appendChild(el('span', cls, val));
      }
      body.appendChild(meta);
    }

    // Examples
    for (const ex of entry.examples) {
      const exDiv = el('div', 'example');
      exDiv.appendChild(el('div', 'lbl', 'Example'));
      const line1 = document.createElement('div');
      line1.appendChild(el('span', 'ex-ipa', ex.ipa));
      if (ex.deva) line1.appendChild(el('span', 'ex-deva', ex.deva));
      if (ex.audio) {
        const exBtn = el('button', 'ex-audio', '▶');
        exBtn.type = 'button';
        exBtn.setAttribute('aria-label', 'Play example audio');
        exBtn.dataset.audio = ex.audio;
        line1.appendChild(exBtn);
      }
      exDiv.appendChild(line1);
      const parts = [];
      if (ex.glossEn) parts.push(ex.glossEn);
      if (ex.glossHi) parts.push(ex.glossHi);
      if (parts.length) exDiv.appendChild(el('div', 'ex-gloss', parts.join(' · ')));
      body.appendChild(exDiv);
    }

    // Note
    if (entry.note) body.appendChild(el('div', 'note', entry.note));

    // Refs
    if (entry.refs.length) {
      const refs = el('div', 'refs');
      refs.appendChild(el('span', 'lbl', 'See also'));
      for (const r of entry.refs) {
        const a = document.createElement('a');
        a.className = 'ref';
        a.href = r.href;
        a.textContent = r.ipa;
        if (r.gloss) a.appendChild(el('span', 'ref-gloss', ' · ' + r.gloss));
        refs.appendChild(a);
        refs.appendChild(document.createTextNode(' '));
      }
      body.appendChild(refs);
    }

    // Categories
    if (entry.categories.length) {
      const cats = el('div', 'cats');
      for (const c of entry.categories) cats.appendChild(el('span', 'cat', c));
      body.appendChild(cats);
    }

    card.appendChild(body);

    // Picture
    if (pictureSrc) {
      const pic = document.createElement('div');
      pic.className = 'pic';
      pic.style.backgroundImage = "url(" + JSON.stringify(pictureSrc) + ")";
      pic.dataset.lightboxSrc = pictureSrc;
      pic.title = 'Click to enlarge';
      pic.setAttribute('role', 'button');
      pic.setAttribute('tabindex', '0');
      card.appendChild(pic);
    }

    return card;
  }

  // ---------- Audio click delegation ----------

  function installAudioHandler(root) {
    root.addEventListener('click', function (e) {
      const btn = e.target.closest('[data-audio]');
      if (!btn) return;
      e.preventDefault();
      e.stopPropagation();
      try {
        new Audio(btn.dataset.audio).play().catch(err => console.warn('Audio playback failed:', err));
      } catch (err) {
        console.warn('Audio constructor failed:', err);
      }
    });
  }

  // ---------- Lightbox ----------

  let currentLightbox = null;

  function openLightbox(src) {
    closeLightbox();
    const overlay = document.createElement('div');
    overlay.className = 'lightbox';
    const img = document.createElement('img');
    img.src = src;
    img.alt = '';
    overlay.appendChild(img);
    const closeBtn = document.createElement('button');
    closeBtn.className = 'close';
    closeBtn.type = 'button';
    closeBtn.setAttribute('aria-label', 'Close');
    closeBtn.textContent = '×';
    overlay.appendChild(closeBtn);
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay || e.target === closeBtn) closeLightbox();
    });
    document.body.appendChild(overlay);
    currentLightbox = overlay;
    closeBtn.focus();
  }

  function closeLightbox() {
    if (currentLightbox) {
      currentLightbox.remove();
      currentLightbox = null;
    }
  }

  function installLightbox() {
    document.addEventListener('click', function (e) {
      const trigger = e.target.closest('[data-lightbox-src]');
      if (trigger) {
        e.preventDefault();
        openLightbox(trigger.dataset.lightboxSrc);
      }
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && currentLightbox) closeLightbox();
    });
  }

  // ---------- Standalone "← Home" header ----------

  function maybeRenderHeader(container) {
    if (window.top !== window.self) return; // suppress inside frameset
    const bar = el('div', 'cards-topbar');
    const home = document.createElement('a');
    home.href = '../index.htm';
    home.textContent = '← Home';
    bar.appendChild(home);
    bar.appendChild(document.createElement('span'));
    container.insertBefore(bar, container.firstChild);
  }

  // ---------- Page transformation ----------

  function transformPage() {
    const paras = Array.from(document.querySelectorAll('p.lpLexEntryPara, p.lpPicturePara'));
    if (!paras.length) return;

    const container = el('div', 'cards-page');
    let pendingPicture = null;

    for (const p of paras) {
      if (p.classList.contains('lpPicturePara')) {
        const img = p.querySelector('img');
        pendingPicture = img ? img.getAttribute('src') : null;
        continue;
      }
      const entry = parseEntry(p);
      if (!entry) continue;
      const card = renderCard(entry, pendingPicture);
      pendingPicture = null;
      container.appendChild(card);
    }

    if (!container.firstChild) return;

    paras[0].parentNode.insertBefore(container, paras[0]);
    for (const p of paras) p.remove();

    maybeRenderHeader(container);
    installAudioHandler(container);
  }

  // ---------- Bootstrap ----------

  function init() {
    transformPage();
    installLightbox();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
```

- [ ] **Step 2: Syntax-check the file**

Run:

```bash
node -e "const fs=require('fs'); const src=fs.readFileSync('assets/cards.js','utf8'); new Function(src); console.log('syntax OK ('+src.length+' bytes)');"
```

Expected: `syntax OK (XXXX bytes)` with a positive byte count. If `Function` throws, fix the syntax error before continuing.

---

## Task 3: Create `scripts/inject-card-includes.mjs`

**Files:**
- Create: `scripts/inject-card-includes.mjs`

- [ ] **Step 1: Write the injector**

Create `scripts/inject-card-includes.mjs` with this exact content:

```javascript
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
```

- [ ] **Step 2: Syntax-check the file**

Run:

```bash
node --check scripts/inject-card-includes.mjs
```

Expected: no output (syntax OK).

---

## Task 4: Run the injector and verify

**Files:**
- Modify: `lexicon/01.htm` – `lexicon/35.htm`
- Modify: `categories/c001.htm` – `categories/c124.htm`

- [ ] **Step 1: Run the injector (first pass — expect every entry file modified)**

Run:

```bash
node scripts/inject-card-includes.mjs
```

Expected output (counts depend on the exact file list — lexicon should be in the 30s, categories around 124):

```
lexicon:    <N> modified, 0 skipped
categories: <M> modified, 0 skipped
```

The "skipped" count should be 0 on the first run. Any `SKIP …: lexiquepro.css <link> not found` warnings indicate an entry page whose `<head>` doesn't include the legacy stylesheet link — those are rare; investigate before proceeding if more than a handful appear.

- [ ] **Step 2: Run a second time to verify idempotence**

Run:

```bash
node scripts/inject-card-includes.mjs
```

Expected: `0 modified` in both rows. The `<N> skipped` count should match the `<N> modified` count from Step 1.

- [ ] **Step 3: Spot-check one modified file**

Run:

```bash
grep -n "cards.css\|cards.js" lexicon/01.htm
```

Expected:

```
... <link rel="stylesheet" href="../assets/cards.css" type="text/css" />
... <script src="../assets/cards.js" defer></script>
```

- [ ] **Step 4: Confirm the inserts are right under the lexiquepro.css link**

Run:

```bash
grep -B1 -A2 'stylesheets/lexiquepro.css' lexicon/01.htm
```

Expected: shows the original `lexiquepro.css` link followed immediately by the new `cards.css` and `cards.js` lines with matching indentation.

---

## Task 5: Smoke test via local HTTP server

**Files:** none

- [ ] **Step 1: Start the dev server (or confirm one is already running on port 8000)**

If the project doesn't already have `python -m http.server 8000` running, the human running this plan should start it. Otherwise reuse it.

A subagent executing this step can skip starting a server and instead do a one-shot smoke test:

```bash
python -m http.server 8765 --directory "$(pwd)" &
SERVER_PID=$!
sleep 1
curl -s -o /dev/null -w "%{http_code} %{size_download} %{url_effective}\n" http://localhost:8765/assets/cards.css http://localhost:8765/assets/cards.js
curl -s http://localhost:8765/lexicon/01.htm | grep -c 'cards\.\(css\|js\)'
kill $SERVER_PID 2>/dev/null
```

Expected:
- `assets/cards.css` returns `200` with size > 0
- `assets/cards.js` returns `200` with size > 0
- `lexicon/01.htm` contains the string `cards.css` or `cards.js` twice

- [ ] **Step 2: Confirm no JS errors via headless syntax check**

Run:

```bash
node -e "const fs=require('fs'); new Function(fs.readFileSync('assets/cards.js','utf8')); console.log('cards.js parses cleanly');"
```

Expected: `cards.js parses cleanly`.

---

## Task 6: Hand off to the user for browser-based manual verification

**Files:** none

Subagents stop after Task 5. The human runs through the 8-step verification checklist from the spec:

1. Search the homepage for "side" (or any word with audio). Click the result. Lands at `lexicon/NN.htm#eN`. The relevant card is highlighted; clicking ▶ plays audio.
2. Open `lexicon/05.htm` and scroll to "dikirɑseni" (scorpion). Picture thumbnail appears on the right of its card. Click it → lightbox opens. Esc closes.
3. Open `lexicon/11.htm` (the empty "g" letter page). Renders title heading; no cards; no JS errors.
4. Open `categories/c001.htm`. Entries render as cards exactly like the lexicon pages.
5. Disable JavaScript and reload an entry page. Falls back to the original paragraph layout (already styled in the warm palette by `lexiquepro.css`).
6. Resize to ≤640px. Cards span full width; picture stacks below text.
7. Open `lexicon/index.htm` (the frameset path). Cards appear inside the body frame with NO "← Home" header (suppressed because the frameset's `title.htm` already provides nav).
8. Click a "See also" cross-reference in a card. Navigates to the target entry; the target card is highlighted on arrival.

If anything fails, report the specific scenario and the observed vs expected output, and we'll fix.

---

## Notes for the implementer

- **No automated tests for cards.js.** The parsing logic is browser-DOM-bound; testing in Node would require a jsdom dependency the project deliberately avoids. The 8-scenario manual checklist is the verification mechanism.
- **Encoding.** The `lexicon/*.htm` files are UTF-8 with IPA and Devanagari content. The injector reads/writes with `'utf8'` explicitly so no transcoding happens.
- **What if the injector hits a file without the lexiquepro.css link?** The script logs a warning and skips. As of the current corpus, all entry files do include the link.
- **Recovery from a botched run.** Since the files are tracked in git, `git diff` shows exactly what changed; `git checkout -- <path>` reverts.
