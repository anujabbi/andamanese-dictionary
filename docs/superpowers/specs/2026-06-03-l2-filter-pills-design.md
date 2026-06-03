# L2 "Show" filter → filter-pills sub-bar

**Date:** 2026-06-03
**Status:** approved
**Scope:** `assets/chrome.js`, `assets/chrome.css` (no new files)

## Problem

On the level-2 pages the annotation filter is a dropdown labelled **Show** pinned to
the far right of the shared header (`chrome.js` → `buildScope()`). Three complaints:

1. Far-right placement is easy to miss.
2. The options are jargon (`ETYM / MORPH / ENV`).
3. A dropdown feels heavier than the choice deserves.

## Decision

Replace the right-aligned dropdown with a **dedicated filter-pill sub-bar** directly
beneath the header, visible on every L2 page (lexicon, the three reverse indexes,
categories). Brainstormed against three other treatments (segmented control,
filter-button + popover, left-rail refine); pills won for discoverability and for
reusing the rounded-pill visual language already on the page.

### The control

```
Show  [ All ]  [ Etymology 262 ]  [ Morphology 1631 ]  [ Environment 1359 ]   Source: [ All sources ▾ ]
```

- Four pills rendered as `<button>`s, **single-select** — exactly one active at a time,
  mirroring today's single dropdown. `All` clears the filter.
- Active pill = filled terracotta (`--accent`), matching the existing active nav/letter state.
- **Counts** are whole-dictionary totals computed once from `search-index.json`
  (Etymology 262, Morphology 1631, Environment 1359 of 3734). `All` shows no count.
  Each counted pill gets a `title` ("across the whole dictionary") so the global figure
  is not mistaken for a per-page count.
- **Labels** are plain words: All / Etymology / Morphology / Environment.
- **Source** dropdown (the existing `.scope-src` `<select>`, still filled by
  `populateSources()` from the 12 distinct etymology sources) is relocated into the bar
  and shown only when **Etymology** is active.

### Behaviour — contract preserved

The filter contract is unchanged, so every downstream consumer keeps working untouched:

- write `sessionStorage['ga.filter']` ∈ `{'', 'etym', 'morph', 'env'}`
- write `sessionStorage['ga.filter.value']` (source; cleared unless Etymology)
- dispatch `document` event `ga:filterchange`
- restore both keys from `sessionStorage` on load

Consumers left as-is: `browse.js` (`initIndexPage.applyListFilter`, `initCategoryPage`),
`filter.js` (legacy panes, read once on load), and `cards.js` filtering.

`GAChrome.mainSelect()` / `sourceSelect()` are exposed but consumed nowhere, so the
underlying DOM is free to change. `.scope` CSS is referenced only in `chrome.css`.

### Sticky-offset rework

Today the dependent sticky panes use **hardcoded** offsets
(`.letterbar top:57px`, `.idx top:101px` / `height:calc(100vh - 101px)`,
`.catlist top:57px`). Adding a ~42px bar shifts all of them. Instead of new magic
numbers, measure the rendered `header + filterbar` height in JS and publish it as a CSS
custom property (`--chrome-top`) on `:root`; rewrite the three `top`/`height` rules to
use it. This stays correct when the bar wraps on mobile and removes the existing brittle
constants. Recompute on resize.

### Mobile

The bar uses `overflow-x:auto` (like the letter row) so pills + source never crowd.
The `@media (max-width:720px)` block uses the same `--chrome-top` variable.

## Out of scope

- Multi-select facets (would require OR/AND logic in `browse.js`/`filter.js`).
- Per-page counts.
- Changing which entries carry etym/morph/env annotations.

## Verification

No lexicon content changes, so no `build-search-index.mjs` re-run needed. Verify in a
browser (companion + Playwright): pills render with counts, single-select toggles the
list correctly on a reverse-index page, the Source dropdown appears only for Etymology,
state survives navigation, and the sticky panes line up under the taller chrome on both
desktop and a narrow viewport.
