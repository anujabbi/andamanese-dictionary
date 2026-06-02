import { test } from 'node:test';
import assert from 'node:assert/strict';
import { firstLetter, sortByOrder, DEV_GA_ORDER, HINDI_ORDER } from '../collation.mjs';

test('firstLetter picks the leading Devanagari letter, skipping hyphens', () => {
  assert.equal(firstLetter('आजूरो', DEV_GA_ORDER), 'आ');
  assert.equal(firstLetter('-आक', DEV_GA_ORDER), 'आ');
  assert.equal(firstLetter('कखग', DEV_GA_ORDER), 'क');
  assert.equal(firstLetter('', DEV_GA_ORDER), '');
});

test('sortByOrder orders by letter index then lexicographically', () => {
  const out = sortByOrder(['कखग', 'आम', 'आज'], s => s, DEV_GA_ORDER).join(',');
  assert.equal(out, 'आज,आम,कखग');
});

test('orders are non-empty and distinct', () => {
  assert.ok(DEV_GA_ORDER.length > 20);
  assert.ok(HINDI_ORDER.length > 20);
  assert.equal(new Set(DEV_GA_ORDER).size, DEV_GA_ORDER.length);
  assert.equal(new Set(HINDI_ORDER).size, HINDI_ORDER.length);
});
