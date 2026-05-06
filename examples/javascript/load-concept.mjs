#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(new URL('../..', import.meta.url).pathname.replace(/^\/(.:\/)/, '$1'));
const query = process.argv[2] || 'blanchiment';
const [concepts, slugMap] = await Promise.all([
  fs.readFile(path.join(root, 'data/dictionaries/concepts.json'), 'utf8').then(JSON.parse),
  fs.readFile(path.join(root, 'data/dictionaries/slug-map.json'), 'utf8').then(JSON.parse)
]);
const conceptId = slugMap[query] || query;
const concept = concepts.find((item) => item.concept_id === conceptId);
if (!concept) {
  console.error('Concept introuvable: ' + query);
  process.exit(1);
}
console.log(JSON.stringify({
  concept_id: concept.concept_id,
  label: concept.label,
  category: concept.category,
  entries: concept.entries?.map((entry) => entry.entry_id) || []
}, null, 2));
