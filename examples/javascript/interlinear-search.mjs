#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(new URL('../..', import.meta.url).pathname.replace(/^\/(.:\/)/, '$1'));
const query = (process.argv[2] || 'H4714').toLowerCase();
const index = JSON.parse(await fs.readFile(path.join(root, 'data/interlinear/at-search-index.json'), 'utf8'));
const col = Object.fromEntries(index.columns.map((name, i) => [name, i]));
const books = index.books;
const hits = index.refs.filter((row) => {
  return ['s', 'x', 'g', 'h'].some((key) => String(row[col[key]] || '').toLowerCase().includes(query));
}).slice(0, 20).map((row) => {
  const book = books[row[col.b]];
  return {
    reference: book.osis + ' ' + row[col.c] + ':' + row[col.v],
    book_fr: book.name_fr,
    strong: row[col.s],
    hebrew: row[col.h],
    transliteration: row[col.x],
    gloss: row[col.g],
    morph: row[col.m]
  };
});
console.log(JSON.stringify(hits, null, 2));
