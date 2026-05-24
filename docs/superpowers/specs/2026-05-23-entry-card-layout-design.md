# Dictionary Entry Card Layout — Design Spec

**Date:** 2026-05-23
**Status:** Draft for implementation

## Background

The dictionary's legacy entry pages (`lexicon/01.htm` – `lexicon/35.htm` and `categories/c001.htm` – `categories/c124.htm`) render each lexicon entry as a single `<p class="lpLexEntryPara">` paragraph with hanging indent and a sequence of inline `<span>` elements identifying each field. The result reads like a dense print-style dictionary entry, which is a fine fallback but feels dated next to the modern homepage we shipped earlier.

The palette and typography of those pages were modernized in May 2026 (`stylesheets/lexiquepro.css`), but the underlying paragraph structure is unchanged. We want a real card-style layout where each entry is a visually distinct unit with structured sections — headword block at top, examples in their own panel, cross-references below, optional picture as a thumbnail to the right.

Direction A from the brainstorm session (card list view) was selected; this spec captures that direction in detail.

## Goal

For every page that displays dictionary entries (`lexicon/*.htm` and `categories/c*.htm`), transform the existing paragraph rendering into a stack of cards — without changing any of the HTML source content. The transformation runs client-side at page load. If JavaScript fails or is disabled, the page falls back to the existing paragraph rendering (already styled with the modern palette via `lexiquepro.css`).

## Scope

**In scope:**

1. New `assets/cards.css` — styles for the card layout, picture thumbnail, and lightbox overlay.
2. New `assets/cards.js` — DOM transformer that walks the paragraph structure of each entry, extracts fields by class name, and replaces the paragraph with a structured card. Also implements the picture lightbox.
3. Adding `<link>` and `<script>` tags to every `lexicon/*.htm` and `categories/c*.htm` page that loads these new assets. (One small Node script, run once.)
4. Lightbox overlay for entry pictures.
5. Compatibility with the existing `javascript/hi.js` fragment-highlight behavior, so that clicking an autocomplete result from the homepage continues to highlight the landed-on card.

**Out of scope:**

- Any content changes. The HTML in `lexicon/*.htm` and `categories/c*.htm` keeps its existing `<p class="lpLexEntryPara">` paragraphs, `<span>` field markers, and audio/picture references. Only the `<head>` of each file gains a `<link>` and a `<script>` tag.
- The reverse-lookup index pages (`index-english/`, `index-hindi/`, `index-ga_in_sript/`) — those show alphabetical link lists, not rich entries, so they keep their current rendering.
- Picture-zoom alternatives (no inline expansion, no thumbnail grid view). Pictures open in a fullscreen lightbox overlay only.
- A new URL scheme. Cards live at the same `lexicon/NN.htm#eN` and `categories/cNNN.htm` URLs as today.
- Editing or replacing `javascript/hi.js`. It keeps doing fragment highlighting; the new card class participates in `.fragment` styling.
- A search bar embedded in the entry pages. The homepage and existing `title.htm` already provide entry points. The card pages get a small "← Home" link in the top bar, nothing more.

## User experience

### Card layout

Each entry becomes a card with this structure (built dynamically from the spans in the source paragraph). Sections appear **only if the underlying field exists** — there is no empty space for missing audio, missing picture, missing examples, etc.

**Card head (always present):**
- IPA headword (Georgia serif, terracotta accent, ~20px)
- Optional homonym subscript (e.g. ɑcɔkʰɔ₂)
- Devanagari headword (smaller, --ink-mute)
- Part-of-speech label (small uppercase --ink-mute)
- If a main-entry audio link exists immediately before the headword in source, a circular "▶" button appears at the right edge of the head row.

**Body:**
- Primary English gloss (--ink, 13px)
- Primary Hindi gloss (--ink-soft, 12px)

**Meta line (only if any meta field present):**
- Optional MORPH (morphology), VAR (variant), Etym (etymology) — each prefaced by a small uppercase label.

**Example blocks (one per example, only if present):**
- Pale-cream tinted panel with a terracotta left border.
- Example IPA (Georgia, --ink)
- Example Devanagari (Georgia, --ink-mute, inline)
- Per-example audio button (▶) if the source has an `<a href="../audio/…">` immediately before the example.
- Example English gloss · Hindi gloss on a second line (--ink-soft).

**Encyclopaedic notes (only if present):**
- Italic --ink-soft text in a thin left-bordered panel.

**Cross-references (only if present):**
- Labeled "See also" or "Variant of" (mapping the existing SEE/VAR mini-headings).
- Each reference is a terracotta link with a small `--ink-mute` gloss next to it (taken from the source's title attribute, e.g. `title="face; चेहरा"`).

**Categories row (only if present):**
- Each `lpCategory` becomes a small terracotta-bordered pill at the bottom of the card.

**Picture (only if a `<p class="lpPicturePara">` immediately precedes this entry in source):**
- 120 × 120 thumbnail on the right side of the card (desktop), or full-width below the body (mobile).
- Cursor is `zoom-in`; click opens the lightbox.

### Picture lightbox

Clicking a thumbnail opens a fullscreen overlay:
- Semi-transparent dark backdrop (rgba(0,0,0,0.85))
- The full-size image centered, capped at `max-width: 92vw; max-height: 92vh`, maintaining its aspect ratio
- A close button (×) in the top-right corner
- Closes on: backdrop click, close-button click, or Esc key
- Only one lightbox can be open at a time; opening a new one closes any previous

The lightbox is created on demand (no DOM cost when no picture is open) and removed on close.

### Page-level header

Card pages are reached two ways:
- **Frameset path:** opening `lexicon/index.htm` or `categories/index.htm` loads `title.htm` on top (logo, top nav, letter bar) and the card page in the body frame. The frameset already has navigation.
- **Standalone path:** opening `lexicon/NN.htm` directly, including arriving from the homepage's autocomplete at `lexicon/NN.htm#eN`. The page has no navigation of its own.

To avoid double-nav in the frameset path, `cards.js` only inserts a new header when it detects standalone context (`window.top === window.self`). The inserted header is a single thin bar at the top of `<body>`:

- Left: "← Home" link → root `index.htm`.
- Nothing on the right. (No embedded search input; the homepage is one click away and already has the autocomplete.)

In the frameset path the page renders with no extra header — entries start at the top of the body frame.

### Highlight on arrival

When a user arrives at `lexicon/NN.htm#eN` via the homepage autocomplete, the existing `javascript/hi.js` adds `class="fragment"` to the element with id `eN`. Our card transformer copies the `id="eN"` from the original headword `<span>` to the new card `<div>`, so `hi.js` finds the card and styles it via:

```css
.entry.fragment { background: var(--hi); border-color: var(--accent-soft); }
```

The same cream-yellow highlight used by the autocomplete dropdown.

### Mobile (≤640px)

- Card width = full viewport minus 24px side padding
- Picture moves from right side to below the body, full card width, fixed 130px height (cropped if portrait, letterboxed if landscape)
- Letter bar (in the frameset path) wraps to multiple rows; in standalone path the "← Home" bar collapses to icon-only.

## Architecture

### File layout

```
assets/cards.css                        # NEW — card layout + lightbox styles
assets/cards.js                         # NEW — DOM transformer + lightbox
scripts/inject-card-includes.mjs        # NEW — one-shot Node script that adds
                                        # <link>/<script> tags to every entry page
lexicon/*.htm                           # MODIFIED — gain two tags in <head>
categories/c*.htm                       # MODIFIED — gain two tags in <head>
javascript/hi.js                        # UNTOUCHED
stylesheets/lexiquepro.css              # UNTOUCHED
title.htm                               # UNTOUCHED
index.htm, about.htm, assets/home.*     # UNTOUCHED
```

### Why a one-shot Node script for the HTML edits

We need the same two tags added to ~160 HTML files. A small `scripts/inject-card-includes.mjs`:

1. Walks `lexicon/*.htm` and `categories/c*.htm`.
2. For each file, checks whether the new `<link rel="stylesheet" href="../assets/cards.css">` is already present. If yes, skips. If no, inserts both tags immediately after the existing `<link rel="stylesheet" href="../stylesheets/lexiquepro.css">` line.
3. Idempotent — safe to re-run.

This is preferred over modifying `javascript/hi.js` to dynamically inject the tags because:
- The HTML files become self-describing about their dependencies (no hidden indirection).
- `hi.js` keeps its single responsibility (fragment highlighting).
- The injection is a one-time setup cost; subsequent re-runs are no-ops.

### `cards.js` structure

A single IIFE (no modules), structured as small isolated units:

- **`parseEntry(p)`** — given a `<p class="lpLexEntryPara">` DOM node, walks its children in order, looks for marker classes (`lpLexEntryName`, `lpLexEntryNameGA_in_Sript`, `lpMorph`, `lpEtymology`, `lpPartOfSpeech`, `lpGlossEnglish`, `lpGlossHindi`, `lpExample`, `lpCrossRef`, `lpCategory`, `lpEncycInfoEnglish`, `lpEncycInfoHindi`) and mini-heading text labels (`MORPH:`, `VAR:`, `Etym:`, `SD:`, `SEE:`, `NT:`) to assemble a structured entry object: `{ id, ipa, hom, deva, morph, var, etym, pos, glossEn, glossHi, audioMain, examples: [...], categories: [...], note, refs: [...] }`. Pure function.
- **`renderCard(entry, picture)`** — builds the card DOM from the structured entry, with the optional preceding picture URL. Pure function returning an HTMLElement.
- **`extractAudioFromPara(p)`** — finds the first `<a href="../audio/...">` in the paragraph that appears before the entry-name span. Pure function returning string or null.
- **`transformPage()`** — finds all `<p class="lpLexEntryPara">` and `<p class="lpPicturePara">`, pairs each picture with the next entry, calls parseEntry + renderCard, and replaces the originals with new cards. Side-effectful but small.
- **`maybeRenderHeader()`** — if `window.top === window.self` (i.e. not inside the frameset), inserts the "← Home" top bar above the entries.
- **`installLightbox()`** — registers a single delegated click handler on `document` that opens the lightbox for any `[data-lightbox-src]` click.
- **`init()`** — entry point on `DOMContentLoaded`: calls `transformPage()`, `maybeRenderHeader()`, `installLightbox()`.

Each function is independently testable in principle; in practice they'll be verified manually since the project has no automated frontend tests.

### Parsing algorithm details

The paragraph's child nodes are walked in document order with a small state machine. The state is one of: `main` (default), `inExample N`, `inSeeAlso`, `inNotes`. Transitions are triggered by mini-heading text:

- `"MORPH:"` → read the next `.lpMorph` span as morphology, stay in current state.
- `"VAR:"` → read the next `.lpMainCrossRef` content as variant. Stay in current state.
- `"Etym:"` → read the next `.lpEtymology` span as etymology. Stay in current state.
- Encountering a `.lpExample` span → start a new example block. Following `.lpGlossGA_in_Sript`, `.lpGlossEnglish`, `.lpGlossHindi` belong to that example until a new mini-heading is seen.
- `"SD:"` → switch to `main` and collect subsequent `.lpCategory` spans as categories.
- `"SEE:"` → switch to `inSeeAlso`; collect subsequent `<a>` elements (each wrapping a `.lpCrossRef`) as cross-references. The reference's tooltip gloss comes from the `<a>`'s `title` attribute (e.g. `title="face; चेहरा"`).
- `"NT:"` → switch to `inNotes`; collect the following `.lpEncycInfoEnglish` and `.lpEncycInfoHindi` content as the encyclopaedic note.

Audio links (`<a href="../audio/…">`) are recognized by their `href`. Their position relative to other markers determines association:
- Immediately before the headword span → main audio.
- Immediately before a `.lpExample` span → that example's audio.

### Visual design tokens

Reuses the existing palette tokens defined at `:root` in `stylesheets/lexiquepro.css`:

| Token         | Use in cards                          |
|---------------|---------------------------------------|
| `--paper`     | Page background (inherited)           |
| `--paper-2`   | Picture placeholder backdrop          |
| `--ink`       | Primary text                          |
| `--ink-soft`  | Secondary glosses, Devanagari headword |
| `--ink-mute`  | POS labels, mini-heading labels       |
| `--rule`      | Card borders, dividers                |
| `--accent`    | IPA headword color, link color, audio icon, category badge color |
| `--accent-soft` | Highlighted card border             |
| `--hi`        | Highlighted card background, example panel hint |

Typography reuses the homepage's `--serif` (Georgia) and `--sans` tokens. IPA headwords and example IPA use the serif; UI elements and glosses use sans.

### Backwards compatibility

If `cards.js` fails to load (404, network error, JS disabled), the existing paragraphs render via `lexiquepro.css` — the same view that was live before this change. The new `<link rel="stylesheet" href="../assets/cards.css">` rules are written so they only target the new `.entry` class structure; they do not affect the legacy `.lp*` paragraph rendering. So either rendering works in isolation.

## Behaviour details

- **Transformation timing:** cards.js runs on `DOMContentLoaded`. The transformation is synchronous and completes before `window.onload`, so `hi.js`'s fragment-highlight (which runs on `window.onload`) finds the new card by id and applies `.fragment`.
- **Picture sourcing:** the picture's `src` is taken verbatim from the source `<img>` tag in the `<p class="lpPicturePara">` element. No URL-rewriting beyond that.
- **Lightbox keyboard:** `Esc` closes. The close button is keyboard-focusable; basic focus management only — no focus trap.
- **Multiple categories:** each `.lpCategory` becomes its own pill. The English and Hindi versions of the same category (e.g. "body part term" and "शारीरिक अंग शब्दावली") both appear as separate pills.
- **Page-level header suppression in frameset:** detected by `window.top !== window.self`. When suppressed, the entries start at the top of the body frame with no extra header.

## Constraints inherited from earlier work

- Lexique Pro is retired; all source files are safe to edit, though we still minimize churn.
- Audio file paths in entry HTML use `../audio/...` because entry pages live one directory deep. Filenames may contain spaces, encoded as `%20` in `href` attributes — no further encoding needed by cards.js since `<a>` clicks navigate directly and we don't intercept them.
- Cross-references use `href="NN.htm#eN"`. Navigation to those targets follows the same flow as today (lands inside the frameset).
- The `id="eN"` numbering must be preserved on the new card so fragment links work.
- The lexicon HTML files contain entity-encoded characters (e.g. `&amp;` in categories). `cards.js` reads `.textContent` of spans, which decodes entities automatically — no manual decoding needed.

## Testing

This is a static site with no test framework. Manual verification before considering done:

1. Open `index.htm` and search for a word with an audio recording (e.g. "side"). Click the result. Lands at `lexicon/01.htm#e13`. The card for ɑcɔkʰɔ₂ is highlighted with the cream background; clicking ▶ plays audio.
2. Open `lexicon/05.htm` directly (not via search). Scroll to "dikirɑseni" (scorpion). Picture thumbnail appears on the right of the card. Click it → lightbox opens with the full-size scorpion image. Esc closes.
3. Open `lexicon/11.htm` (the empty "g" letter page). No entries → no errors, no spurious cards. Page renders the title heading and stops.
4. Open `categories/c001.htm` (or any category page). Entries are rendered as cards just like the lexicon pages.
5. Open any entry page with JavaScript disabled. Falls back to the legacy paragraph rendering with the new palette. No JS errors in the console.
6. Resize the browser to ≤640px. Cards take full width; pictures stack below the body text; the "← Home" header (if shown) collapses to icon.
7. Navigate via the frameset (open `lexicon/index.htm`). The card view appears inside the body frame; the "← Home" header is suppressed (the frameset's `title.htm` already provides nav).
8. Click a "See also" cross-reference inside a card. Navigates correctly to the target entry; the destination card is highlighted via `hi.js`.

## Open questions to resolve during implementation

- **Lightbox image loading state:** if the full-size image is large (some pictures are 1MB+), do we show a loading spinner? Ship without a spinner first; add one only if visible delay is observed in practice.
- **Category pill click target:** v1 ships pills as non-interactive labels (the existing `categories/index.htm` already provides a category browser). Revisit if user wants in-card filtering later.
