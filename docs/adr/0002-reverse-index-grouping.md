# 2. Reverse-index lists fold on the gloss, and only on the gloss

Date: 2026-08-25

## Status

Accepted

## Context

The left-hand list on the reverse-index pages repeats itself. On the English
index, 4,619 rows carry only 3,005 distinct terms; *fish* alone accounts for
113 consecutive rows reading "fish, fish, fish…". The repetition is correct
data — one gloss, many Great Andamanese words — but as a flat list it reads as
a fault, and it leaves the reader guessing which row is the real one.

The generated source already knew this. Lexique Pro wrote a repeated term as a
ditto mark (`&#183;`), and `browse.js` deliberately expands it back to the full
term. The repetition on screen is something this project re-introduced, not
something inherent in the data.

Two facts shaped the rule:

- **The lists do not all repeat for the same reason.** The English and Hindi
  lists are keyed on a **gloss**, where repetition means "many words, one
  meaning". The Great Andamanese script list is keyed on a **headword form**,
  where repetition means homographs — 247 shared Devanagari forms, at most 6
  deep.
- **A folder hides its contents.** That is the point when the contents are 113
  ways of saying *fish*, and exactly wrong when the contents are the very
  script forms the reader is scanning for.

## Decision

Fold list rows that share a term into one collapsible group, **only where the
term is a gloss** — the English and Hindi native lists. Never on a list of
headword forms, in either the Great Andamanese script list or the `देव` /
`a–z` alternate modes.

Fold at **2 or more members**, uniformly. What the folder removes is not a
saved line but a false repeat.

Clicking a group both expands it *and* renders every member as a card in the
entry pane — a gloss group is treated as an ad-hoc category, reusing the
rendering path `categories/` already uses. Because the pane holds one group at
a time, expansion is an accordion: two open folders would leave the list
claiming something the pane does not show.

## Consequences

- A group's count badge states how many members are **actually reachable**,
  not how many rows exist: the scope filter reduces it, and a member whose
  entry cannot be resolved is dropped from it.
- Opening a large group is a real fetch. `fish` pulls 24 lexicon documents;
  requests are grouped by file so each is fetched once rather than once per
  entry.
- Grouping is computed from the term string at render time, not read from the
  ditto marks. The generated indexes are no longer authoritative about which
  rows belong together, which is the right way round now that the generator is
  retired.
- Uncovered by this change: **1,365 of the 13,453 rows** across the three
  reverse indexes (about 10%) point at entry ids that do not exist anywhere in
  `lexicon/`. This is a pre-existing defect in the generated indexes. Opening a
  folder is the first moment the code can detect it, so those rows are hidden
  and logged rather than silently over-counted — but the same dead rows still
  exist, unfolded and unfixed, everywhere else in the indexes.

## Alternatives considered

- **Fold at 4 or more.** Only 29 English glosses have 4+ members under the
  search index's keys; it would leave the overwhelming majority of repeats on
  screen and solve nothing.
- **Group everywhere, including the script list.** Rejected: folding
  homographs hides the forms the reader came to scan, and conflates "same
  meaning" with "same spelling" — two different claims about the language.
- **Disclosure only, leaving the pane untouched.** Makes the group row a dead
  click: the reader must open 113 entries one at a time to see the fish.
- **Render the group without expanding the list.** Breaks the list's own
  logic, where every row highlights and drives the pane.
- **Normalise terms before grouping** (case- and punctuation-folded). Rejected:
  merging near-miss glosses asserts they mean the same thing, and nothing in
  the data supports that.
