import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fixMediaRefs, resolveMediaRef } from '../fix-media-refs.mjs';

// Pretend disk: apostrophes stored as underscores, like the real repo.
const ON_DISK = new Set([
  "audio/my_Adam_s Apple.wav",
  "pictures/turtle_s shell.bmp",
  "audio/plain.wav",
]);
const exists = (p) => ON_DISK.has(p);

test('resolveMediaRef leaves a reference that already resolves alone', () => {
  assert.equal(resolveMediaRef('audio/plain.wav', exists), null);
});

test("resolveMediaRef maps an apostrophe to the underscore spelling on disk", () => {
  assert.equal(resolveMediaRef("audio/my_Adam's Apple.wav", exists), 'audio/my_Adam_s Apple.wav');
});

test('resolveMediaRef decodes percent-escapes before looking on disk', () => {
  assert.equal(resolveMediaRef("pictures/turtle's%20shell.bmp", exists), 'pictures/turtle_s shell.bmp');
});

test('resolveMediaRef gives up when no candidate exists', () => {
  assert.equal(resolveMediaRef("audio/gone's missing.wav", exists), null);
});

test('fixMediaRefs rewrites broken references and reports them', () => {
  const html = '<a href="../audio/my_Adam\'s Apple.wav"><img src="../images/sound-icon.png"/></a>' +
               '<img src="../pictures/turtle\'s%20shell.bmp"/>' +
               '<a href="../audio/plain.wav">ok</a>';
  const { html: out, fixes } = fixMediaRefs(html, exists);
  assert.equal(fixes.length, 2);
  assert.ok(out.includes('../audio/my_Adam_s Apple.wav'));
  // The percent-encoded reference keeps its encoding.
  assert.ok(out.includes('../pictures/turtle_s%20shell.bmp'));
  assert.ok(out.includes('../audio/plain.wav'));
  // Unrelated images are untouched.
  assert.ok(out.includes('../images/sound-icon.png'));
});

test('fixMediaRefs is idempotent — a repaired file is left alone', () => {
  const html = '<a href="../audio/my_Adam_s Apple.wav">x</a>';
  const { html: out, fixes } = fixMediaRefs(html, exists);
  assert.equal(fixes.length, 0);
  assert.equal(out, html);
});
