#!/usr/bin/env node
/**
 * After the build: checks that every internal link and picture in dist/ points to something that exists.
 *   node scripts/check-links.mjs            report broken links (build does not fail)
 *   node scripts/check-links.mjs --strict   fail the build when something is broken
 * While articles are still being moved from the prototype, some links point to articles
 * that don't exist yet — so the default is "report only". Switch to --strict once all are moved.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const strict = process.argv.includes('--strict');

if (!fs.existsSync(DIST)) { console.error('dist/ not found — run the build first'); process.exit(1); }

const pages = [];
(function walk(dir) {
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, f.name);
    if (f.isDirectory()) { if (f.name !== 'pagefind' && f.name !== '_astro') walk(p); }
    else if (f.name.endsWith('.html')) pages.push(p);
  }
})(DIST);

function exists(url) {
  const clean = decodeURI(url.split('#')[0].split('?')[0]);
  if (!clean || clean === '/') return fs.existsSync(path.join(DIST, 'index.html'));
  const p = path.join(DIST, clean);
  if (clean.endsWith('/')) return fs.existsSync(path.join(p, 'index.html'));
  return fs.existsSync(p) || fs.existsSync(path.join(p, 'index.html'));
}

const broken = new Map(); // url → pages
for (const file of pages) {
  const html = fs.readFileSync(file, 'utf8');
  const page = '/' + path.relative(DIST, file).replace(/index\.html$/, '').replace(/\\/g, '/');
  for (const m of html.matchAll(/\s(?:href|src|poster)="(\/[^"]*)"/g)) {
    const url = m[1];
    if (url.startsWith('//') || url.startsWith('/pagefind/') || url.startsWith('/_astro/')) continue;
    if (!exists(url)) {
      if (!broken.has(url)) broken.set(url, new Set());
      broken.get(url).add(page);
    }
  }
}

console.log(`\nLink check: ${pages.length} pages.`);
if (!broken.size) { console.log('All internal links and files are OK.'); process.exit(0); }
const articles = [...broken.keys()].filter((u) => /^\/[a-z0-9-]+\/$/.test(u));
const other = [...broken.keys()].filter((u) => !articles.includes(u));
if (articles.length) {
  console.log(`\nLinks to articles that don't exist yet (${articles.length}):`);
  for (const u of articles.sort()) console.log(`  ${u}  ← ${[...broken.get(u)].join(', ')}`);
}
if (other.length) {
  console.log(`\nBroken links to files or pages (${other.length}):`);
  for (const u of other.sort()) console.log(`  ${u}  ← ${[...broken.get(u)].join(', ')}`);
}
if (strict) { console.error('\nLink check failed (--strict).'); process.exit(1); }
console.log('\n(report only — run with --strict to fail the build on broken links)');
