# 1. Card legibility tokens are scoped to `.entry`, not `:root`

Date: 2026-08-25

## Status

Accepted

## Context

Readers reported that the word on a card and its meaning were hard to see, and
suggested larger type and a colour change.

Measuring first changed the diagnosis:

- Contrast was mostly **fine**. The headword sat at 5.87:1 on the white card.
  Exactly one token failed WCAG AA — `--ink-mute` at **4.07:1** — carrying the
  Devanagari form, part of speech, and meta labels.
- Size was the real defect, and there was a **hierarchy inversion**: the
  headword was 20px while the English gloss — the thing a reader is there for —
  was 13px. The word rendered at 154% the size of its meaning.
- `cards.css` held 112 hard `px` values and one `rem`, so the site **ignored
  the reader's browser and OS font-size setting entirely**. Readers who had
  already enlarged text system-wide were being overridden.
- The Devanagari form was set in `--serif` (Georgia), which contains **no
  Devanagari glyphs**, so it fell back per-glyph to an OS default — the
  smallest, lowest-contrast and worst-fitted text on the card.

The change was scoped deliberately to the cards. That scope collided with the
obvious fix. Stylesheet load order on a card page is:

```
lexiquepro.css  →  cards.css  →  chrome.css
```

`cards.css` redeclares the design tokens *after* `lexiquepro.css`, and
`chrome.css` declares none of its own. So editing `--ink-mute` in `cards.css`'s
`:root` would have silently restyled the sticky header and letter bar —
outside the agreed scope.

A second constraint: cards are rendered by three different callers.
`cards.js` builds a `.cards-page` container, but `browse.js` and `chrome.js`
call `GACards.renderCard` and append into wrappers of their own. Scoping to
`.cards-page` would have missed every card in the reverse-index panes.

## Decision

Introduce card-scoped custom properties declared on **`.entry`** — the one
selector common to all three render paths — rather than modifying `:root`:

- `--card-ink-mute: #6b5c46` (6.47:1, up from 4.07:1)
- `--card-deva`, a real Devanagari font stack

Convert card **type** to `rem` so the reader's browser setting is finally
honoured, while leaving borders, radii and the `--chrome-top-lb` scroll offset
in `px` so sticky-header maths does not drift as text scales.

Recompress the scale rather than scaling uniformly, so the gloss closes on the
headword: the headword-to-gloss ratio moves from **1.54 to 1.40**, and nothing
on a card renders below 12px.

Set explicit leading. The file previously declared **no `line-height` at all**,
so every card ran at the browser default of roughly 1.2 — which meant the first
size increase read as *denser*, not larger, and was reported as "no
difference". Card base leading is now 1.6, with headwords tightened to 1.25.

Devanagari gets looser leading than the Latin beside it (Hindi gloss 1.75,
example Devanagari 1.7). Devanagari stacks matras above and below the baseline
and collides at leading that is perfectly comfortable for Latin.

| | before | after |
|---|---|---|
| Headword | 20px | 28px |
| English gloss | 13px | 20px |
| Hindi gloss | 12px | 19px |
| Devanagari headword | 13px | 20px |
| Example gloss | 11px | 17px |
| Labels and chips | 8-9px | 12-13px |
| Card padding | 14x16px | 20x22px |
| Line height | browser default (~1.2) | 1.6 base |

## Consequences

- The global palette is untouched; header, letter bar, homepage and the legacy
  paragraph styles render exactly as before.
- There are now two names for "muted text". `--card-ink-mute` is the correct
  one **inside a card**; `--ink-mute` remains correct everywhere else. This is
  the cost of the scope boundary and should be revisited if the tokens are ever
  consolidated into a single source of truth (they are currently triplicated
  across `assets/cards.css`, `assets/home.css` and `stylesheets/lexiquepro.css`).
- **Cards are roughly twice as tall** (measured: ~270px average, against a
  viewport that previously held about three and a half cards and now holds
  two). A letter page scrolls considerably more. Accepted knowingly: it is a
  real regression for a researcher skimming many entries, and a clear gain for
  the primary reader. If it needs winding back, the dial to turn first is card
  padding and the example block, not the type sizes.
- Because type is now `rem`-based, a future reader-facing text-size control
  becomes one `font-size` declaration on `:root` instead of ~112 overrides.

## Alternatives considered

- **Darken `--ink-mute` globally.** One edit, fixes all three declaration
  sites — but leaks into the chrome and breaks the agreed scope.
- **Hardcode the darker hex per rule.** Same result, vocabulary discarded.
- **Uniform ×1.25 scale-up.** Preserves the hierarchy inversion that caused the
  complaint; the card gets bigger and the meaning still reads as fine print.
- **Ship a reader-facing A / A+ / A++ control now.** Deferred. Its natural home
  is the sticky header, which this change does not touch, and the `rem`
  conversion means the browser's own controls now work. Revisit if the new
  baseline does not settle the feedback.
- **Self-host a Devanagari webfont.** Rejected: new network weight on a site
  that must keep working from `file://`.
