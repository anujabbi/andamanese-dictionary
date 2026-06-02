import { test } from 'node:test';
import assert from 'node:assert/strict';
import { categoryList } from '../category-list.mjs';

test('categoryList maps each category page to its name', () => {
  const list = categoryList();
  assert.ok(list.length >= 100);
  assert.ok(list.every(c => /^c\d{3}\.htm$/.test(c.file) && c.name));
  assert.equal(list[0].file, 'c001.htm');
  assert.equal(list[0].name, 'activity & event');
});
