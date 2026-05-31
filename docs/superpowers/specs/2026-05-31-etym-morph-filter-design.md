# ETYM / MORPH Tag Filtering — Design

**Date:** 2026-05-31
**Issue:** #2 — to be **updated** to cover the homepage *and* all four legacy
views (its original text is homepage-only). This spec is the source of truth.

## Goal

Let scholars filter the Great Andamanese dictionary to entries that carry an
**Etymology** (`lpEtymology`) or **Morphology** (`lpMorph`) note. The filter must
work on the modern homepage **and** all four legacy frameset views
(lexicon, English / Hindi / Devanagari reverse indexes, categories).

## Decisions (locked during brainstorming)

| Decision | Choice |
| --- | --- |
| Control style | **Option C** — a scope selector ("All entries / With etymology / With morphology") |
| Legacy placement | The shared top menu bar (`title.htm`), visible across every frameset view |
| Browse behavior | **Hide** untagged entries (show only entries that carry the selected tag) |
| Cross-frame mechanism | **URL query param** (`?filter=etym` on the content frame), file://-safe and deep-linkable |
| Scope | Homepage + all four legacy views |
| Tag values | `etym` and `morph` only (no "Environmental Lexicon") |
| Issue tracking | Update issue #2 to match this expanded scope |

## Background constraints

- The legacy pages are **framesets**: the menu (`title.htm`) sits in its own
  frame, separate from the content frame(s). The site must keep working under
  `file://`, `python -m http.server`, and GitHub Pages.
- Under `file://`, reading a **sibling frame's DOM is blocked** (opaque origins),
  but cross-frame **navigation** (`frame.location = …`) is allowed — which is all
  this design uses, exactly like the existing `javascript/index-go.js`.
- Markup realities found in the codebase:
  - **Lexicon pages** (`lexicon/NN.htm`) and **category pages**
    (`categories/cNNN.htm`) render entries as
    `<p class="lpLexEntryPara"><span id="eN" …>…</span></p>` with inline
    `<span class="lpMorph">` / `<span class="lpEtymology">` children, and **both
    already load `assets/cards.js`**, which rewrites those paragraphs into
    `<article class="entry" id="eN">` cards. `cards.js` *already parses*
    `entry.morph` and `entry.etym` (see `parseEntry`, lines ~66–70).
  - **Reverse-index panes** (`index-*/NN.htm`) are **`<table>` rows**, each a
    `<tr>` containing the gloss and `<a href="javascript:go('NN','NNNN')">`. The
    entry id is the second `go()` argument (`3525` → `e3525`). They load only
    `javascript/index-go.js`, **not** `cards.js`, and contain no tag spans.
  - `lpEtymology` appears twice per etymological entry: the GA/source value
    (`Bale`) and a nested Hindi span
    (`<span class="lpEtymology"><span class="lpUserStylefn">बाले</span></span>`).
    The GA value is the `lpEtymology` span that has **no element child**.

## Architecture

The active filter is carried in the content frame's URL as `?filter=etym` (or
`morph`, or absent). Each piece reads it and acts locally; no sibling-frame DOM
access is ever needed.

```
            ?filter=etym  (on the content-frame URL)
        ▲                                   │ read on load
        │ written / propagated by           ▼
  ┌───────────────┐                  ┌──────────────────────────────┐
  │ Control:      │                  │ Entry pages → cards.js         │
  │ • title.htm   │ ── navigates ──▶ │   (already has etym/morph;     │
  │   selector +  │   content frame  │   hide non-matching cards)     │
  │   letter bar  │   with ?filter   │ Index panes → filter.js        │
  │ • homepage    │                  │   (map go() id via id-set)     │
  └───────────────┘                  └──────────────────────────────┘
                                              │ id-set source
                                              ▼
                              assets/search-index.json (+ etym/morph)
```

### 1. Data layer — `scripts/build-search-index.mjs`

- Add two new optional fields per entry:
  - `morph`: text of the `lpMorph` span, omitted if absent.
  - `etym`: text of the GA `lpEtymology` span (the one with **no element
    child** — never the nested Hindi span), omitted if absent.
- Keep all existing fields/ordering otherwise unchanged; regenerate
  `assets/search-index.json`.
- Extend `scripts/tests/` (`node:test`):
  - entry with both tags → both fields; `etym` is the GA value, not Hindi;
  - entry with only one tag;
  - entry with neither → neither field present.

> Note: only the **index panes** consume these JSON fields. Entry pages get the
> data straight from `cards.js`. The homepage autocomplete also uses them.

### 2. Filtering on entry pages — fold into `assets/cards.js`

`cards.js` already parses `etym`/`morph` and builds each card. Extend it:

- When rendering, set `data-has-etym` / `data-has-morph` on the card element
  (derived from the values it already computes).
- After the page is transformed, read `getFilter()` (from `location.search`) and
  add a `ga-filtered-out` class to cards lacking the active tag. `""` shows all.
- Re-applying must be idempotent.
- If a filter leaves a page with zero visible cards, append a small
  "No entries with an etymology note on this page" line (prevents a blank pane).

### 3. Filtering on reverse-index panes — `assets/filter.js`

A new small IIFE (vanilla, no modules), loaded **only** by the index panes:

- On load, read `getFilter()` from `location.search`. If empty, do nothing.
- Lazily `fetch('../assets/search-index.json')` once, build a `Set` of ids that
  have the active tag (`etym` or `morph`).
- For each `<tr>` containing `a[href^="javascript:go("]`, parse the second
  `go()` argument, form `e<id>`, and hide the `<tr>` (via `ga-filtered-out`) when
  the id is not in the set.
- Same zero-results note as above.

### 4. Hiding style

Add to `assets/cards.css`: `.ga-filtered-out { display: none; }` — class-based so
it is trivially reversible; never inline styles.

### 5. The control

**Shared helper** (in `filter.js`, also referenced by `cards.js`): `getFilter()`
returns `location.search`'s `filter` value, validated to `"" | "etym" | "morph"`.

**Legacy — `title.htm`:**
- Add a `<select id="ga-scope">` (`All entries`=`""`, `With etymology`=`etym`,
  `With morphology`=`morph`) into the top menu, styled to the paper/terracotta
  palette. Initialise its value from the current content-frame filter.
- On `change`, **re-navigate the content frame(s)** to their current page with
  the new `?filter=` value:
  - Lexicon / categories: set `parent.basefrm.location` to its current path with
    the param swapped.
  - Reverse indexes: do the same for both `parent.indexframe` (index pane) and
    `parent.basefrm` (lexicon content pane).
  - Guard each frame with feature/`try` checks.
- **Letter-bar propagation:** the existing letter cells do
  `parent.basefrm.location='lexicon/NN.htm'`. Update them (or wrap via a small
  helper in `title.htm`) to append the current `?filter=` so navigating letters
  preserves the filter.

**Index navigation — `javascript/index-go.js`:**
- `go(letterFile, entryId)` currently sets `parent.basefrm.location`. Have it
  read the **index pane's own** `?filter=` (which `title.htm` set when it
  navigated the index frame) and append it to the target URL, so jumping from an
  index entry into the lexicon keeps the filter. This is the single place the
  ~78 generated `go('NN','NNNN')` calls funnel through — no per-file edits.

**Homepage — `index.htm` / `assets/home.js` / `assets/home.css`:**
- Add the Option-C scope selector at the left edge of the search bar.
- `searchIndex(query, index, filter)` filters to entries whose `etym`/`morph`
  field is present before scoring.
- Wire with a **single clean `change` listener** — no monkey-patching of
  `onInput`, no double-bound handlers (the explicit failure of reverted commit
  79f3040). Reflect the choice in the homepage URL (`?filter=`) so a link from
  the homepage into a legacy view can carry the filter through.

### 6. Loading the scripts

- **Entry pages** (lexicon + categories): already load `cards.js`; filtering
  rides along. Verify the include exists on every such file; add where missing.
- **Index panes** (`index-*/NN.htm`, ~78 files): add one
  `<script src="../assets/filter.js" defer></script>` include (mechanical,
  scripted edit; preserve UTF-8 — never let the editor re-save as Windows-1252).
- **Homepage**: uses `home.js`; does not need `filter.js`.

## Data flow (legacy reverse index, end to end)

1. User picks "With etymology" in the `title.htm` selector.
2. Handler re-navigates `indexframe` and `basefrm` to their current pages with
   `?filter=etym`.
3. The reloaded index pane runs `filter.js`: fetches the id-set, hides `<tr>`
   rows whose `go()` id lacks an etymology. The reloaded lexicon pane runs
   `cards.js`, which hides untagged cards.
4. Clicking an index entry calls `go('NN','NNNN')`; it reads the pane's
   `?filter=etym` and navigates `basefrm` to `lexicon/NN.htm?filter=etym#eNNNN`,
   so the lexicon pane stays filtered and still highlights the entry.
5. Picking a letter in the top bar navigates `basefrm` with the param preserved.
6. "All entries" re-navigates with no param → everything visible again.

## Testing

- **Automated (`node:test`):** the build-script extraction cases in §1; run
  `node scripts/build-search-index.mjs` and keep the suite green.
- **Manual matrix** (`file://` and `python -m http.server`):
  - Lexicon: filter hides untagged cards; letter nav preserves filter.
  - Each reverse index: index pane hides non-qualifying rows; clicking through to
    the lexicon keeps the filter and highlights the entry.
  - Categories: filter hides untagged cards.
  - Homepage: autocomplete narrows to tagged entries.
  - "All entries" fully restores every view.

## Out of scope (YAGNI)

- The "Environmental Lexicon" aggregation category (the other half of #1).
- Any tag beyond `etym` / `morph`; multi-tag / combined filtering.
- Reworking the deprecated frameset layout or the audio plugin.

## Files touched

- `scripts/build-search-index.mjs` + `scripts/tests/*` — new fields + tests.
- `assets/search-index.json` — regenerated.
- `assets/filter.js` — new: `getFilter()` + index-pane filtering.
- `assets/cards.js` — set `data-has-*`, apply filter to cards.
- `assets/cards.css` — `.ga-filtered-out` + scope-selector styles.
- `title.htm` — scope selector, change handler, letter-bar propagation.
- `javascript/index-go.js` — propagate `?filter=` into `basefrm`.
- `index.htm`, `assets/home.js`, `assets/home.css` — homepage selector + filter.
- `index-*/NN.htm` (~78) — add `filter.js` include.
- Verify `cards.js` include present on all `lexicon/*.htm` + `categories/*.htm`.

## Follow-up (outside the build)

- Update GitHub issue **#2** so its text covers all four legacy views + homepage,
  matching this spec.
