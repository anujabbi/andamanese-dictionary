# Context

Glossary for the Great Andamanese dictionary. Vocabulary only — no
implementation detail. If a term here disagrees with the code, one of them
is wrong; say so rather than quietly using both meanings.

## Entry

A single dictionary record: one headword together with everything said about
it. Stable identity is the `eN` anchor (`e13`), and that identity is depended
on from other files, so an entry's id outlives any edit to its content.

## Headword

The word being defined, in **IPA**. The anchor a reader scans for. An entry has
exactly one headword.

Not to be confused with the entry's **Devanagari form** — see *Script*.

## Script

Great Andamanese is written here in two scripts: **IPA** and **Devanagari**.
Both render the *same* headword. The Devanagari form is not a translation and
not a gloss; it is the same word in another writing system, for readers who do
not read IPA.

Consequence: the Devanagari form carries the same informational weight as the
IPA headword and must not be styled as secondary matter.

## Gloss

The **meaning** of a headword, given in a language the reader already knows.
An entry carries parallel glosses — **English** and **Hindi** — which are
siblings, not original-and-translation. Neither is authoritative over the other.

"Translation" is not used in this project: it implies a source and a target,
and these glosses have neither.

## Sense

A distinct meaning of the same headword. An entry with more than one sense
still has one headword and one `eN` id.

## Category

A semantic grouping (`Fish`, `Kinship`). A category is a **cross-reference,
not a label** — every category string resolves to exactly one category page.
A string that resolves to nothing is a bug, not a free-form tag.

## Reader

Two audiences, deliberately weighted:

- **Primary — the Great Andamanese community and heritage learners.** Reach
  for audio, pictures, Hindi and Devanagari. Recognition over notation.
- **Secondary — linguists and researchers.** Served, not optimised for.

Where the two conflict, the primary reader wins. Legibility decisions in
particular assume a reader who may be older and may have already enlarged text
at the OS level.

## Card

The rendered presentation of an entry. Cards are built by JavaScript from the
underlying markup.

Surprising property worth stating: **the accessible rendering is the
JavaScript one.** With JS disabled a reader falls back to the legacy
paragraph view, which is typographically smaller than the cards. That fallback
is a compatibility path, not an equivalent experience.
