# Environmental Lexicon aggregation tag — design

**Issue:** #3 (split from #1). Earlier combined attempt `79f3040` was reverted in `46b3711`.
**Date:** 2026-05-31

## Goal

Add an **Environmental Lexicon** aggregation tag that groups entries drawn from 19
existing semantic categories, and let users filter the homepage search to just those
entries via the existing scope dropdown.

## Decisions

- **Tag storage:** written into the lexicon HTML (not derived only at build time), so the
  tag is real and visible on the legacy entry pages. *(Overrides the issue's "derive in
  build script only" suggestion — user instruction takes precedence; we preserve the
  spirit of the issue's "no ad-hoc hardcoded-path scripts" caution by making the tagging
  step a committed, repo-relative, idempotent, tested script.)*
- **Markup:** a dedicated `lpEnvLex` span, NOT a third `lpCategory` span (a category span
  would make "Environmental" masquerade as a real semantic category).
- **Visibility:** rendered as a small visible pill. NOTE: the lexicon entry pages are
  re-rendered client-side by `assets/cards.js` (a prior "entry-card-layout" project), which
  parses each legacy `<p class="lpLexEntryPara">` into an `<article class="entry">` card and
  removes the original paragraph. So the pill must be produced by `cards.js` + `cards.css`;
  the `lexiquepro.css` rule remains only as the no-JS fallback.
- **Browse-page filter:** `cards.js` already filters its cards by ETYM/MORPH using the shared
  `ga.filter` sessionStorage key. ENV is wired into the same mechanism, so selecting ENV on the
  homepage carries into the browse pages and hides non-environmental cards — consistent with
  ETYM/MORPH.
- **Dropdown label:** `ENV` (matches the terse `ETYM` / `MORPH` style).
- **UI surface:** one new option in the existing `#ga-scope` select; reuse the existing
  `bindScope` / `activeFilter` / `searchIndex` filter pattern. No `onInput` monkey-patching
  or double-bound handlers (those were the defects that got `79f3040` reverted).

## Canonical category list (actual data labels)

The issue's prose names do not all match the real `lpCategory` labels. The canonical set
used by the tagging script is the **actual labels**:

| Issue prose | Actual `lpCategory` label | Entry count |
|---|---|---|
| bird | `bird` | 85 |
| boat related | `boat related` | 34 |
| direction | `direction` | 7 |
| edible fruit | `edible fruit` | 54 |
| edible items | `edible item` | 69 |
| fire | `fire` | 18 |
| fish | `fish` | 125 |
| flora | `flora` | 307 |
| hunting and gathering | `hunting & gathering` | 77 |
| marine | `marine` | 121 |
| medicine | `medicine` | 10 |
| natural environment | `natural environment` | 260 |
| navigation | `navigation` | 7 |
| place | `place` | 5 |
| reptile | `reptile` | 45 |
| season | `season` | 15 |
| space | `space` | 75 |
| super natural | `supernatural` | 13 |
| insect and invertebrate | `insect & invertebrate` | 87 |

Total: **~1,414 of 3,753 entries (~38%)**. In HTML, `&` appears as `&amp;`; the labels
are compared after entity decoding (or the canonical list stores the `&amp;` form — see
implementation note).

Matching is **exact equality** against the decoded English `lpCategory` labels of each entry —
NOT substring `includes()`. Substring matching is what made the reverted attempt silently miss
`edible item`, `supernatural`, `hunting & gathering`, and `insect & invertebrate`.

**An entry may carry more than one semantic domain.** ~148 entries have multiple `lpCategory`
pairs, and 38 environmental entries have their environmental category in a *non-first* position
(e.g. a word tagged both `tool` and `fish`). The tag is applied if **any** of an entry's
categories is environmental — tagging only the first category would silently miss those 38.
Final tagged count: **1,359** of 3,734 indexed entries.

## Components

### 1. `scripts/tag-environmental.mjs` (new)

- Holds the canonical 19-label set.
- Resolves the lexicon dir via `import.meta.url` (repo-relative, no hardcoded paths).
- For each `lexicon/NN.htm`: split into entry paragraphs (reuse the same
  `<p class="lpLexEntryPara">…</p>` boundary the build parser uses), read each entry's
  first `lpCategory`, and if it is in the set, insert
  `<span class="lpEnvLex">Environmental</span>` immediately before the entry's closing
  `</p>`.
- **Idempotent:** if the entry already contains `lpEnvLex`, skip it. Re-running is a no-op.
- Writes files back as UTF-8 (no Windows-1252 re-encode; preserve IPA + Devanagari).
- Reports a summary count to stdout.
- Exposes pure helpers (e.g. `isEnvironmental(category)`, `tagEntry(block)`) for testing.

### 2. `scripts/build-search-index.mjs` (edit)

- In `parseEntry`, detect the `lpEnvLex` span and set `entry.env = true` when present
  (omit the key otherwise, matching the existing optional-key convention).
- A new `extractEnv(block)` pure helper, consistent with the file's existing style.

### 3. `index.htm` (edit)

- Add `<option value="env">ENV</option>` to `#ga-scope`, after `MORPH`.

### 4. `assets/home.js` (edit)

- `activeFilter()` accepts `'env'` as a valid value alongside `'etym'`/`'morph'`.
- In `searchIndex`, add: `if (filter === 'env' && !e.env) continue;`
- The ETYM source sub-value dropdown stays hidden for `env` (unchanged
  `syncScopeValueVisibility` logic — only `etym` shows it).

### 5. `stylesheets/lexiquepro.css` (edit)

- New `.lpEnvLex` rule: small pill (terracotta accent, rounded, small caps or uppercase),
  consistent with the May 2026 homepage palette.

## Data flow

```
tag-environmental.mjs  →  writes <span class="lpEnvLex"> into lexicon/*.htm
build-search-index.mjs →  reads lpEnvLex  →  entry.env:true in search-index.json
home.js (#ga-scope=env)→  filters results to entries where e.env
lexiquepro.css         →  renders the pill on legacy entry pages
```

## Testing

- `scripts/tests/` gains coverage for:
  - `isEnvironmental` — exact-match true/false, including the four renamed labels and a
    near-miss that must NOT match (e.g. `edible items` plural, `super natural` two words).
  - `tagEntry` idempotency — tagging an already-tagged block is a no-op.
  - `build-search-index` `extractEnv` — `env:true` present when the span exists, key absent
    otherwise.
- Manual / pipeline steps after implementation:
  1. `node scripts/tag-environmental.mjs`
  2. `node scripts/build-search-index.mjs`
  3. `node --test scripts/tests/` green
  4. Open `index.htm`, choose `ENV`, confirm search filters; open a tagged entry, confirm
     the pill renders.

## Out of scope

- No changes to the `categories/` frameset tree, reverse indexes, or a standalone browse
  page (UI surface is the search scope dropdown only).
- No changes to audio/picture handling.

## Risks / notes

- ~1,414 entries get edited by the tagging script — large diff, but mechanical and
  idempotent. Review a sample of the diff before committing.
- Entity form of `&`: ensure the canonical comparison handles `hunting & gathering` /
  `insect & invertebrate` correctly (compare decoded text, or store the `&amp;` form).
- Keep `id="eN"` anchors and all existing `lp*` class names untouched.
