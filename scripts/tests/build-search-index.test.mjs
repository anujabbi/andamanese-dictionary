import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  extractEntryBlocks,
  parseEntry,
  extractMainAudio,
  cleanGloss,
  decodeEntities,
  extractEnv,
} from '../build-search-index.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const fixtureHtml = readFileSync(join(here, 'fixtures/sample-lexicon.htm'), 'utf8');

test('cleanGloss trims whitespace and trailing punctuation', () => {
  assert.equal(cleanGloss('  main word;   '), 'main word');
  assert.equal(cleanGloss('मुख्य शब्द.'), 'मुख्य शब्द');
  assert.equal(cleanGloss('two glosses; second sense; '), 'two glosses; second sense');
  assert.equal(cleanGloss(''), '');
});

test('decodeEntities turns HTML entities back into literal characters', () => {
  assert.equal(decodeEntities('insect &amp; invertebrate'), 'insect & invertebrate');
  assert.equal(decodeEntities('&lt;tag&gt;'), '<tag>');
  assert.equal(decodeEntities('a&nbsp;b'), 'a b');
  assert.equal(decodeEntities('it&#39;s'), "it's");
  assert.equal(decodeEntities('&amp;amp;'), '&amp;');
});

test('cleanGloss decodes HTML entities (the bug that motivated this test)', () => {
  assert.equal(cleanGloss('insect &amp; invertebrate'), 'insect & invertebrate');
  assert.equal(cleanGloss('costume &amp; adornment.'), 'costume & adornment');
});

test('extractEntryBlocks returns one string per entry paragraph', () => {
  const blocks = extractEntryBlocks(fixtureHtml);
  assert.equal(blocks.length, 7);
  assert.ok(blocks[0].includes('main-audio-word'));
  assert.ok(blocks[4].includes('homonym-word'));
});

test('extractMainAudio finds audio link BEFORE the headword', () => {
  const blocks = extractEntryBlocks(fixtureHtml);
  assert.equal(extractMainAudio(blocks[0]), 'audio/main word.wav');
});

test('extractMainAudio ignores audio link AFTER the headword (example audio)', () => {
  const blocks = extractEntryBlocks(fixtureHtml);
  assert.equal(extractMainAudio(blocks[1]), null);
});

test('extractMainAudio returns null when there is no audio link at all', () => {
  const blocks = extractEntryBlocks(fixtureHtml);
  assert.equal(extractMainAudio(blocks[2]), null);
});

test('parseEntry extracts all fields when present', () => {
  const blocks = extractEntryBlocks(fixtureHtml);
  const entry = parseEntry(blocks[0], 'sample-lexicon.htm');
  assert.deepEqual(entry, {
    id: 'e1',
    file: 'sample-lexicon.htm',
    ipa: 'main-audio-word',
    deva: 'मुख्य',
    en: 'main word',
    hi: 'मुख्य शब्द',
    cat: 'test-category',
    audio: 'audio/main word.wav',
  });
});

test('parseEntry omits audio when no main audio present', () => {
  const blocks = extractEntryBlocks(fixtureHtml);
  const entry = parseEntry(blocks[1], 'sample-lexicon.htm');
  assert.equal(entry.audio, undefined);
  assert.equal(entry.en, 'example only');
});

test('parseEntry omits en when no English gloss present', () => {
  const blocks = extractEntryBlocks(fixtureHtml);
  const entry = parseEntry(blocks[3], 'sample-lexicon.htm');
  assert.equal(entry.en, undefined);
  assert.equal(entry.hi, 'केवल हिंदी');
});

test('parseEntry strips homonym subscripts from the IPA headword', () => {
  const blocks = extractEntryBlocks(fixtureHtml);
  const entry = parseEntry(blocks[4], 'sample-lexicon.htm');
  assert.equal(entry.ipa, 'homonym-word');
});

test('parseEntry extracts morph and the GA etymology (not the Hindi span)', () => {
  const blocks = extractEntryBlocks(fixtureHtml);
  const entry = parseEntry(blocks[5], 'sample-lexicon.htm');
  assert.equal(entry.morph, 'tag-both');
  assert.equal(entry.etym, 'Bale'); // GA value, never the nested बाले
});

test('parseEntry omits etym when only morph is present', () => {
  const blocks = extractEntryBlocks(fixtureHtml);
  const entry = parseEntry(blocks[6], 'sample-lexicon.htm');
  assert.equal(entry.morph, 'm-only');
  assert.equal(entry.etym, undefined);
});

test('parseEntry omits morph and etym when neither is present', () => {
  const blocks = extractEntryBlocks(fixtureHtml);
  const entry = parseEntry(blocks[2], 'sample-lexicon.htm'); // no-audio-word
  assert.equal(entry.morph, undefined);
  assert.equal(entry.etym, undefined);
});

test('extractEnv is true when the lpEnvLex marker is present, false otherwise', () => {
  const blocks = extractEntryBlocks(fixtureHtml);
  assert.equal(extractEnv(blocks[5]), true);   // e6 carries the marker
  assert.equal(extractEnv(blocks[6]), false);  // e7 does not
});

test('parseEntry sets env:true only for marked entries', () => {
  const blocks = extractEntryBlocks(fixtureHtml);
  assert.equal(parseEntry(blocks[5], 'sample-lexicon.htm').env, true);
  assert.equal(parseEntry(blocks[6], 'sample-lexicon.htm').env, undefined);
});
