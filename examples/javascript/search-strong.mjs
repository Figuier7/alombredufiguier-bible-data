#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(new URL('../..', import.meta.url).pathname.replace(/^\/(.:\/)/, '$1'));
const query = (process.argv[2] || 'H4714').toLowerCase();
const entries = JSON.parse(await fs.readFile(path.join(root, 'data/hebrew/hebrew-lexicon-fr-compact.json'), 'utf8'));
const hits = entries.filter((entry) => {
  const values = [entry.s, entry.x, entry.ig, entry.d, ...(entry.g || []), ...(entry.bd || [])]
    .filter(Boolean)
    .map((value) => String(value).toLowerCase());
  return values.some((value) => value.includes(query));
}).slice(0, 10);
console.log(JSON.stringify(hits.map((entry) => ({
  strong: entry.s,
  hebrew: entry.h,
  transliteration: entry.x,
  gloss: entry.ig || entry.g?.[0],
  definition: entry.d
})), null, 2));
