/* scripts/fix-media-refs.mjs — repair audio/picture references whose filename
   does not match the file on disk.

   The media files were checked in with apostrophes replaced by underscores
   ("my_Adam_s Apple_THakErToTToe.wav") while the Lexique-Pro-generated HTML
   still points at the original name ("my_Adam's Apple_THakErToTToe.wav"), so
   those players and images 404 in every view. This rewrites the reference to
   the name that actually exists.

   Run: node scripts/fix-media-refs.mjs [--dry-run]
*/
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// Matches an href/src pointing one level up into audio/ or pictures/.
const MEDIA_REF = /(?:href|src)="\.\.\/((?:audio|pictures)\/[^"]+)"/g;

// The on-disk spelling of a referenced path, or null when it already resolves
// (or when no candidate exists). `exists` takes a repo-root-relative path.
export function resolveMediaRef(ref, exists) {
  const decoded = decodeURIComponent(ref);
  if (exists(decoded)) return null;
  const candidate = decoded.replace(/'/g, '_');
  if (candidate !== decoded && exists(candidate)) return candidate;
  return null;
}

// Rewrite every broken media reference in one HTML file. Returns
// { html, fixes: [{ from, to }] }; `html` is unchanged when there are no fixes.
export function fixMediaRefs(html, exists) {
  const fixes = [];
  const out = html.replace(MEDIA_REF, (whole, ref) => {
    const fixed = resolveMediaRef(ref, exists);
    if (!fixed) return whole;
    fixes.push({ from: decodeURIComponent(ref), to: fixed });
    // Preserve the reference's own encoding style: if the original escaped
    // spaces, escape them in the replacement too.
    const encoded = ref.includes('%20') ? fixed.replace(/ /g, '%20') : fixed;
    return whole.replace(ref, encoded);
  });
  return { html: out, fixes };
}

// ---------- CLI ----------

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
  const dryRun = process.argv.includes('--dry-run');
  const exists = (p) => existsSync(join(repoRoot, p));
  let files = 0, total = 0;
  for (const dir of ['lexicon', 'categories']) {
    for (const name of readdirSync(join(repoRoot, dir)).filter(f => f.endsWith('.htm'))) {
      const path = join(repoRoot, dir, name);
      const { html, fixes } = fixMediaRefs(readFileSync(path, 'utf8'), exists);
      if (!fixes.length) continue;
      files++; total += fixes.length;
      for (const f of fixes) process.stdout.write(`${dir}/${name}: ${f.from} -> ${f.to}\n`);
      if (!dryRun) writeFileSync(path, html, 'utf8');
    }
  }
  process.stdout.write(`${dryRun ? 'Would fix' : 'Fixed'} ${total} reference(s) in ${files} file(s)\n`);
}
