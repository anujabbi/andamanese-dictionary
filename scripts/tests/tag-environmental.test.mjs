import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isEnvironmental, tagBlock, tagHtml } from '../tag-environmental.mjs';

test('isEnvironmental matches actual category labels exactly', () => {
  assert.equal(isEnvironmental('flora'), true);
  assert.equal(isEnvironmental('natural environment'), true);
  assert.equal(isEnvironmental('supernatural'), true);
  assert.equal(isEnvironmental('edible item'), true);
});

test('isEnvironmental decodes HTML entities before matching', () => {
  assert.equal(isEnvironmental('insect &amp; invertebrate'), true);
  assert.equal(isEnvironmental('hunting &amp; gathering'), true);
});

test('isEnvironmental tolerates trailing punctuation/whitespace', () => {
  assert.equal(isEnvironmental('flora.'), true);
  assert.equal(isEnvironmental('  fish  '), true);
});

test('isEnvironmental rejects the issue prose names that do not match the data', () => {
  assert.equal(isEnvironmental('edible items'), false);   // plural
  assert.equal(isEnvironmental('super natural'), false);  // two words
  assert.equal(isEnvironmental('grammar'), false);
  assert.equal(isEnvironmental('animal'), false);
});

const ENV_BLOCK =
  '<p class="lpLexEntryPara"><span id="e9" class="lpLexEntryName">w</span> ' +
  '<span class="lpMiniHeading">SD:&nbsp;</span><span class="lpCategory">flora</span>' +
  '<span class="lpPunctuation">, </span><span class="lpCategory">वनस्पति</span></p>';

const NON_ENV_BLOCK =
  '<p class="lpLexEntryPara"><span id="e10" class="lpLexEntryName">x</span> ' +
  '<span class="lpCategory">grammar</span></p>';

test('tagBlock inserts the pill before </p> for an environmental entry', () => {
  const out = tagBlock(ENV_BLOCK);
  assert.ok(out.includes('<span class="lpEnvLex">Environmental</span></p>'));
});

test('tagBlock is idempotent — re-tagging an already-tagged block is a no-op', () => {
  const once = tagBlock(ENV_BLOCK);
  const twice = tagBlock(once);
  assert.equal(twice, once);
});

test('tagBlock leaves a non-environmental entry untouched', () => {
  assert.equal(tagBlock(NON_ENV_BLOCK), NON_ENV_BLOCK);
});

test('tagHtml tags every environmental paragraph and reports the count', () => {
  const html = '<body>' + ENV_BLOCK + '\n' + NON_ENV_BLOCK + '</body>';
  const { html: out, count } = tagHtml(html);
  assert.equal(count, 1);
  assert.equal((out.match(/lpEnvLex/g) || []).length, 1);
});
