import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addChrome } from '../add-chrome.mjs';

const PAGE = '<html><head>\n<link rel="stylesheet" href="../assets/cards.css" />\n<script src="../assets/cards.js" defer></script>\n</head><body><p class="lpLexEntryPara">x</p></body></html>';

test('addChrome injects chrome includes exactly once (idempotent)', () => {
  const once = addChrome(PAGE, { section: 'lexicon', base: '../' });
  assert.ok(once.includes('assets/chrome.css'));
  assert.ok(once.includes('assets/chrome.js'));
  assert.ok(once.includes("section:'lexicon'"));
  assert.ok(once.includes("base:'../'"));
  const twice = addChrome(once, { section: 'lexicon', base: '../' });
  assert.equal(twice, once);
});
