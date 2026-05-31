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
| State mechanism | **`sessionStorage["ga.filter"]`** only — no URL param (per-tab; resets when the tab closes) |
| Scope | Homepage + all four legacy views |
| Tag values | `etym` and `morph` only (no "Environmental Lexicon") |
| Issue tracking | Update issue #2 to match this expanded scope |

## Background constraints

- The legacy pages are **framesets**: the menu (`title.htm`) sits in its own
  frame, separate from the content frame(s). The site must keep working under
  `file://`, `python -m http.server`, and GitHub Pages.
- Under `file://`, reading a **sibling frame's DOM/URL is blocked** (opaque
  origins), but cross-frame **navigation** (`frame.location = …`,
  `frame.location.reload()`) is allowed.
- **Why `sessionStorage`, and the file:// caveat.** Each content page reads the
  active filter from `sessionStorage` on load and applies it locally, so no
  cross-frame reads are ever needed and a selector change just reloads the
  content frame(s) in place (position preserved). `sessionStorage` is shared
  across all frames/navigations of a tab on the **same origin** — guaranteed on
  GitHub Pages (https) and `python -m http.server` (http://localhost). Under
  `file://`, cross-document storage sharing is browser-dependent; the dictionary
  is published on GitHub Pages, so this is an accepted edge. (The homepage
  already relies on `localStorage` for "recent" entries.)
- Markup realities found in the codebase:
  - **Lexicon pages** (`lexicon/NN.htm`) and **category pages**
    (`categories/cNNN.htm`) render entries as
    `<p class="lpLexEntryPara"><span id="eN" …>…</span></p>` and **both already
    load `assets/cards.js`**, which rewrites those paragraphs into
    `<article class="entry" id="eN">` cards. `cards.js` *already parses*
    `entry.morph` and `entry.etym` (`parseEntry`, lines ~66–70).
  - **Reverse-index panes** (`index-*/NN.htm`) are **`<table>` rows**, each a
    `<tr>` with the gloss and `<a href="javascript:go('NN','NNNN')">`. The entry
    id is the second `go()` argument (`3525` → `e3525`). They load only
    `javascript/index-go.js`, **not** `cards.js`, and contain no tag spans.
  - `lpEtymology` appears twice per etymological entry: the GA/source value
    (`Bale`) and a nested Hindi span
    (`<span class="lpEtymology"><span class="lpUserStylefn">बाले</span></span>`).
    The GA value is the `lpEtymology` span with **no element child** — a
    `<span class="lpEtymology">([^<]*)</span>` match naturally captures it and
    skips the nested one.

## Architecture

The active filter lives only in `sessionStorage["ga.filter"]` ∈ `{"", "etym",
"morph"}`. Each piece reads it and acts locally.

```
        sessionStorage["ga.filter"]  ∈ { "", "etym", "morph" }
        ▲                                   │ read on load → apply()
        │ written by                        ▼
  ┌───────────────┐                  ┌──────────────────────────────┐
  │ Control:      │  reload content  │ Entry pages → cards.js         │
  │ • title.htm   │ ───frame(s)────▶ │   (already has etym/morph;     │
  │   selector    │   in place       │   hide non-matching cards)     │
  │ • homepage    │                  │ Index panes → filter.js        │
  │   selector    │                  │   (map go() id via id-set)     │
  └───────────────┘                  └──────────────────────────────┘
                                              │ id-set source
                                              ▼
                              assets/search-index.json (+ etym/morph)
```

### 1. Data layer — `scripts/build-search-index.mjs`

- In `parseEntry`, add two new optional fields:
  - `morph`: `cleanGloss` of the `lpMorph` span; added only when present.
  - `etym`: `cleanGloss` of the GA `lpEtymology` span (regex `[^<]*` body, so the
    nested Hindi span is never matched); added only when present.
- Keep all existing fields/ordering; regenerate `assets/search-index.json` via
  `node scripts/build-search-index.mjs`.
- Extend the fixture + `node:test` suite (see Task plan): both tags, GA-not-Hindi
  etym, single tag, neither.

> Only the **index panes** consume these JSON fields. Entry pages get the data
> from `cards.js`; the homepage autocomplete also uses them.

### 2. Filtering on entry pages — fold into `assets/cards.js`

`cards.js` already parses `etym`/`morph` and builds each card. Extend it:

- When rendering a card, set `data-has-etym` / `data-has-morph` attributes from
  the values it already computes (`entry.etym` / `entry.morph`).
- After the page is transformed, read the active filter (a small local
  `readFilter()` reading `sessionStorage["ga.filter"]`, validated to
  `"" | "etym" | "morph"`) and add class `ga-filtered-out` to cards lacking the
  active tag. `""` shows everything. Idempotent.
- If filtering leaves zero visible cards, append one
  `<p class="ga-empty">No entries with an etymology note on this page.</p>`
  line (wording adapts to etym/morph).

### 3. Filtering on reverse-index panes — `assets/filter.js`

New small IIFE (vanilla, no modules), loaded **only** by index panes:

- On `DOMContentLoaded`, read `readFilter()`. If empty, do nothing.
- Lazily `fetch('../assets/search-index.json')` once, build a `Set` of ids whose
  entry has the active tag.
- For each `<tr>` containing `a[href^="javascript:go("]`, parse the second
  `go()` argument → `e<id>`, and add `ga-filtered-out` to the `<tr>` when the id
  is not in the set.
- Same zero-results note (`ga-empty`) when nothing remains.

### 4. Hiding style — `assets/cards.css`

Append: `.ga-filtered-out { display: none; }`, the `.ga-empty` note style, and
the scope-selector styling (paper/terracotta). cards.css is loaded by entry
pages; the index panes get the same `.ga-filtered-out`/`.ga-empty` rules — add a
`<link>` to cards.css there too (alongside the `filter.js` include), or inline
the two rules in filter.js via a tiny injected `<style>`. **Chosen:** load
`cards.css` on index panes (one extra `<link>`), keeping all filter styling in
one file.

### 5. The control

**Legacy — `title.htm`:**
- Add `<select id="ga-scope">` (`All entries`=`""`, `With etymology`=`etym`,
  `With morphology`=`morph`) into the top menu, styled to the palette.
- On load: set its value from `sessionStorage["ga.filter"]`.
- On `change`: write `sessionStorage["ga.filter"]`, then reload the content
  frame(s) **in place** so each re-applies on load:
  - Lexicon / categories: `parent.basefrm.location.reload()`.
  - Reverse indexes: reload `parent.indexframe` **and** `parent.basefrm`.
  - Guard each with `try {}` / existence checks.
- **No letter-bar or `index-go.js` changes needed**: any navigation loads a fresh
  content page, which reads `sessionStorage` and applies the active filter
  automatically.

**Homepage — `index.htm` / `assets/home.js` / `assets/home.css`:**
- Add the Option-C scope selector at the left edge of the search bar.
- `searchIndex(query, index, filter)` filters to entries whose `etym`/`morph`
  field is present before scoring.
- Initialise the selector from `sessionStorage["ga.filter"]`; on change, write
  `sessionStorage` and re-run the current query. **Single clean `change`
  listener — no monkey-patching of `onInput`, no double-bound handlers** (the
  explicit failure of reverted commit 79f3040).

### 6. Loading the scripts

- **Entry pages** (lexicon + categories): already load `cards.js`/`cards.css`;
  filtering rides along. Verify includes exist; add where missing.
- **Index panes** (`index-*/NN.htm`, ~78 files): add
  `<link rel="stylesheet" href="../assets/cards.css" type="text/css" />` and
  `<script src="../assets/filter.js" defer></script>` via a one-shot injector
  script modeled on the existing `scripts/inject-card-includes.mjs`
  (idempotent; preserves UTF-8 — never re-save as Windows-1252).
- **Homepage**: uses `home.js`; no `filter.js` needed.

## Data flow (legacy reverse index, end to end)

1. User picks "With etymology" in the `title.htm` selector.
2. Handler writes `sessionStorage["ga.filter"]="etym"`, reloads `indexframe` and
   `basefrm` in place.
3. Reloaded index pane runs `filter.js`: fetches the id-set, hides `<tr>` rows
   whose `go()` id lacks etymology. Reloaded lexicon pane runs `cards.js`, hiding
   untagged cards.
4. Clicking an index entry calls `go('NN','NNNN')` → `basefrm` loads
   `lexicon/NN.htm#eNNNN`; on load `cards.js` reads `sessionStorage`, applies the
   filter, and `hi.js` highlights the entry.
5. Picking a letter in the top bar loads a fresh lexicon page → filter auto-applies.
6. "All entries" writes `""` and reloads → everything visible.

## Testing

- **Automated (`node:test`):** build-script extraction (fixture + cases below).
  Run `node --test scripts/tests/` and keep green; `node scripts/build-search-index.mjs`
  regenerates the JSON.
- **Manual matrix** (`python -m http.server`, also spot-check `file://`):
  - Lexicon: filter hides untagged cards; letter nav preserves filter.
  - Each reverse index: pane hides non-qualifying rows; clicking through keeps
    the filter and highlights the entry.
  - Categories: filter hides untagged cards.
  - Homepage: autocomplete narrows to tagged entries.
  - "All entries" fully restores every view.

## Out of scope (YAGNI)

- The "Environmental Lexicon" aggregation category (the other half of #1).
- Any tag beyond `etym` / `morph`; multi-tag / combined filtering.
- URL-param / deep-linkable filter state.
- Reworking the deprecated frameset layout or the audio plugin.

## Files touched

- `scripts/build-search-index.mjs` + `scripts/tests/*` — new fields + tests.
- `assets/search-index.json` — regenerated.
- `assets/filter.js` — new: `readFilter()` + index-pane filtering.
- `assets/cards.js` — set `data-has-*`, apply filter to cards.
- `assets/cards.css` — `.ga-filtered-out`, `.ga-empty`, scope-selector styles.
- `title.htm` — scope selector + change handler (write storage, reload frames).
- `index.htm`, `assets/home.js`, `assets/home.css` — homepage selector + filter.
- `scripts/inject-filter-includes.mjs` — new one-shot injector for index panes.
- `index-*/NN.htm` (~78) — gain `cards.css` + `filter.js` includes (via injector).
- Verify `cards.js`/`cards.css` includes on all `lexicon/*.htm` + `categories/*.htm`.

## Follow-up (outside the build)

- Update GitHub issue **#2** so its text covers all four legacy views + homepage.
