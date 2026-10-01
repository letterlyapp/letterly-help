#!/usr/bin/env node
/**
 * Description check (warnings only — never fails the build).
 * Search engines show the article `description` under the title. A good one is 70–160 characters,
 * a complete sentence about what the article helps with, and does not end with a colon.
 *   node scripts/check-descriptions.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const MIN = 70;
const MAX = 160;
const DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/content/articles');

function readDescription(src) {
  const fm = src.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1] ?? '';
  const line = fm.match(/^description:[ \t]*(.*)$/m)?.[1]?.trim() ?? '';
  if (line.startsWith('"') && line.endsWith('"')) return line.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\').trim();
  if (line.startsWith("'") && line.endsWith("'")) return line.slice(1, -1).replace(/''/g, "'").trim();
  return line;
}

const problems = [];
for (const file of fs.readdirSync(DIR).filter((f) => f.endsWith('.mdx')).sort()) {
  const d = readDescription(fs.readFileSync(path.join(DIR, file), 'utf8'));
  const why = [];
  if (d.length < MIN) why.push(`too short (${d.length})`);
  if (d.length > MAX) why.push(`too long (${d.length})`);
  if (d.endsWith(':')) why.push('ends with ":"');
  if (why.length) problems.push(`  ${file.replace(/\.mdx$/, '')} — ${why.join(', ')}: ${d}`);
}

if (problems.length) {
  console.warn(`\nDescription check (warning only, does not fail the build): ${problems.length} article(s) need a better description.`);
  console.warn(`Rule: ${MIN}–${MAX} characters, a complete sentence about what the article helps with, no ":" at the end.`);
  console.warn(problems.join('\n'));
} else {
  console.log('\nDescription check: all descriptions are OK.');
}
process.exit(0);
