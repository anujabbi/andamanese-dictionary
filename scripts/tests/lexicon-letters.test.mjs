import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lexiconLetters } from '../lexicon-letters.mjs';

test('lexiconLetters covers every lexicon page with its IPA letter label', () => {
  const map = lexiconLetters();
  assert.equal(map.length, 35);
  assert.equal(map[0].file, '01.htm');
  assert.ok(map[0].label && map[0].label.length <= 3);
  assert.ok(map.every(m => /^\d{2}\.htm$/.test(m.file) && m.label));
});
