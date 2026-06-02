# Level-2 pages redesign — design

**Date:** 2026-06-02
**Context:** The homepage (`index.htm`) and the entry **cards** (`assets/cards.js`/`cards.css`)
were modernized in May 2026, but the "level-2" pages (lexicon, the three reverse indexes,
categories) are still 2018 Lexique-Pro **HTML framesets** wrapped around the dated
`title.htm` menu. The modern cards inside a dated frameset shell look broken by contrast.
This redesign replaces the frameset shell with modern, responsive, single-document pages.

## Goals

- Remove the frameset architecture from every level-2 page; rebuild as single responsive
  documents that deep-link, work on mobile, and share one modern shell.
- Match the homepage/cards visual language (paper, Georgia serif headwords, terracotta accent).
- Preserve all existing capabilities: per-script letter navigation, the side-by-side
  index→entry experience, the scope filter, audio, and `#eN` fragment highlight.

## Decisions (from brainstorming)

- **Layout:** modern sticky header + **top letter row** (lexicon "Option B" style) on every
  letter-indexed page; **two-pane** (list ↔ selected entry, loaded in place) for the reverse
  indexes and categories.
- **Two letter indexes via a script toggle** `[a–z | देव]` on every letter-indexed page:
  - **Lexicon** & **Devanagari (GA_in_Sript)**: **IPA ⇄ Devanagari** of the GA headword.
  - **English**: **English a–z ⇄ GA Devanagari** (same list, re-ordered by the chosen script).
  - **Hindi**: **Hindi अ–ह ⇄ GA Devanagari**.
- **Show filter** lives in the header (All / ETYM / MORPH / ENV) with room for the ETYM
  **source** sub-dropdown; uses the shared `ga.filter` (+ `ga.filter.value`) sessionStorage key.
- **Categories** has no letters → category list in the left pane (no letter row).
- **Mobile:** two-pane stacks (list above, selected entry below).
- **Scope:** all of it, in one spec/plan, single implementation pass before review.
- Menu label `GA_in_Sript - GA` is renamed **Devanagari**.

Visual reference: throwaway mockups under `mockups/` (not committed); the script-toggle index
page is `mockups/option-2bar-toggle.htm`, lexicon is `mockups/option-b.htm`.

## Architecture

Frameless pages, a shared injected chrome, and reuse of the existing card renderer. Lists keep
their existing per-letter HTML for fidelity; `assets/search-index.json` supplies the data needed
for the alternate-script ordering and in-place rendering.

### New: `assets/chrome.js` + `assets/chrome.css`

A single IIFE every level-2 page loads. Responsibilities:
- Inject the sticky **header**: wordmark (→ `../index.htm`), nav (Lexicon / Devanagari /
  English / Hindi / Categories) with active state derived from the current path, and the
  **Show** control (main select All/ETYM/MORPH/ENV + a `source` select shown only for ETYM),
  wired to `ga.filter` / `ga.filter.value`.
- Render the **letter row** + **script toggle** for the page type, from a small per-page config
  (which scripts apply, which is default). Clicking a letter scrolls/loads that letter section;
  toggling swaps the letter set and the list ordering.
- Emit a `ga:filterchange` notification (or call the page's filter hook) so `cards.js`/`browse.js`
  re-apply the active filter — consistent with today's `ga.filter` behavior.

`chrome.js` replaces `title.htm` entirely.

### Refactor: `assets/cards.js`

Extract `parseEntry(p)` and `renderCard(entry, pictureSrc)` onto a small namespace
(e.g. `window.GACards = { parseEntry, renderCard }`) so the two-pane pages can render an entry
parsed from a **fetched** document, not only from the current page. `cards.js` keeps transforming
full letter/category pages as it does today (it just calls the extracted functions).

### New: `assets/browse.js` (two-pane in-place)

Used by the reverse-index and category pages:
- Builds the **left list** from the page's existing per-letter HTML table (full sense fidelity),
  enriched with each entry's `deva`/`ipa` from `search-index.json` (looked up by `file`+`id`)
  to enable the alternate-script ordering.
- On letter click: shows that letter's slice of the list (and applies the active script ordering).
- On term click: fetches the target `lexicon/NN.htm`, extracts the `#eN` paragraph, renders it
  with `GACards.renderCard`, and shows it in the right pane (updates `location.hash` for
  deep-linking). No full-page reload.
- Categories: left list = the category set; clicking a category fetches that `categories/cNNN.htm`
  and renders its entries as cards in the right pane.

### Edit: `assets/filter.js`

Add the `env` case (mirrors the `etym`/`morph` handling already there) using `entry.env` from
`search-index.json`, so All/ETYM/MORPH/ENV filter uniformly on the index/list pages too.

### Removed

- All `*/index.htm` framesets (`lexicon/`, `index-english/`, `index-hindi/`,
  `index-ga_in_sript/`, `categories/`).
- `title.htm`.
- `categories/tree.htm`, `javascript/ftiens4.js`, `javascript/categoryNodes.js`, `javascript/ua.js`.
- `javascript/index-go.js` (replaced by `browse.js` in-place loading).
- Per-page `alphalinks.htm` frame pages (their letters move into the header letter row).

### Preserved

- `id="eN"` anchors and all `lp*` class names (the renderer and `search-index.json` depend on them).
- Audio playback (native `Audio`, as `cards.js` already does).
- `javascript/hi.js` fragment highlight on entry pages.
- The cards look (`cards.css`).

## Per-page behavior

### Lexicon (`lexicon/`)
`lexicon/index.htm` becomes a real page (lands on the first letter). Each `lexicon/NN.htm`
is a standalone document: chrome header + letter row + cards.
- **IPA mode (default):** letter-row links are real URLs to the sibling per-IPA-letter pages
  (`lexicon/NN.htm`) → deep-linkable; `cards.js` transforms the entries as today.
- **Devanagari mode (toggle):** the physical files are split by IPA letter, so a Devanagari
  letter view is **data-driven** — `browse.js` groups entries by Devanagari first-letter (from
  `search-index.json`, in the defined Devanagari collation) and renders that letter's entries as
  cards via `GACards.renderCard`, reusing the same ordering engine as the Devanagari index. This
  is the most complex single piece; the implementation plan will isolate it.

### Reverse indexes (`index-english/`, `index-hindi/`, `index-ga_in_sript/`)
One page each: chrome header + letter row (with the page's toggle pair) + two-pane. Left = term
list (gloss ↔ GA IPA); right = selected entry card, loaded in place. A–z/Devanagari toggle
re-orders the list and swaps the letter set. Default left-pane state shows a short hint until a
term is chosen; a `#eN` in the URL pre-selects and renders that entry.

### Categories (`categories/`)
One page: chrome header + two-pane. Left = category list; right = that category's entries as
cards, loaded in place. No letter row.

## Data & ordering

- `search-index.json` already provides `ipa`, `deva`, `en`, `hi`, `cat`, `env`, `file`, `id` —
  enough for list ordering, the GA-Devanagari alternate sort, and filter membership.
- **Devanagari collation:** define an explicit Devanagari letter order (independent for the GA
  Devanagari script and the Hindi script) in `chrome.js`/`browse.js`; sort by mapping each term's
  first relevant character to its index in that order. The order is derived from the existing
  `alphalinks.htm` letter sequences (already curated per language).
- **Known simplification to confirm:** the left lists are built from the existing per-letter
  index HTML (which preserves multiple senses per entry). If a future change instead drives lists
  purely from `search-index.json`, multi-sense duplicate rows would collapse to one per entry —
  out of scope here; we keep the existing tables.

## Navigation, URLs, deep-linking

- Lexicon letters are distinct pages (`lexicon/NN.htm`) — bookmarkable.
- Reverse-index/category selections update `location.hash` (`#eN` / `#cNNN`) so a selected entry
  is shareable and survives reload (the page re-fetches and renders it).
- Header nav points at each section's landing page.

## Filtering consistency

One `ga.filter` (+ `ga.filter.value`) key drives the Show control everywhere. `cards.js`
(`applyFilter`) and `filter.js` both honor `etym`/`morph`/`env`; `chrome.js` writes the key and
triggers re-apply. Selecting a scope on the homepage carries into the level-2 pages.

## Accessibility & responsive

- Header nav collapses to a compact/menu form on narrow screens; letter row wraps or
  horizontally scrolls; two-pane stacks (list, then entry).
- Letter row and toggle are real focusable controls (keyboard + ARIA: toggle as a group of
  buttons, current letter marked `aria-current`).
- Selected list item marked `aria-current`; entry pane is a labeled region.

## Out of scope

- The homepage (`index.htm`) and the card *content* design — unchanged.
- The Environmental-lexicon feature (already shipped).
- Regenerating or restructuring `search-index.json` content (only consumed here).
- Audio engine changes.

## Risks

- Largest change to date: removes the entire frameset layer across ~5 page groups.
- Two-pane in-place loading and the GA-Devanagari alternate ordering are new JS.
- Devanagari collation must be defined explicitly (no reliable locale collation under `file://`).
- Many generated files load scripts via relative paths; adding `chrome.js` to each letter page
  is a scripted, idempotent edit (like the env-tagging migration), not hand edits.

## Testing

- **Node `node:test`:** pure helpers — Devanagari collation/ordering, the list-enrichment
  (join index rows to `search-index.json` by `file`+`id`), and `filter.js` env membership.
- **Manual / Playwright (served over HTTP):** for each page type — header + nav active state;
  letter row + script toggle switches letters and ordering; reverse-index term click renders the
  entry in the right pane; category click renders cards; Show filter (incl. ETYM source and ENV)
  filters; `#eN` deep-link pre-selects; mobile stacking; audio plays; `hi.js` highlight works.
- Verify the removed framesets/Treeview files are gone and no page references them.
