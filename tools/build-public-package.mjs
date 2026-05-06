#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const repoRoot = path.resolve(new URL('..', import.meta.url).pathname.replace(/^\/(.:\/)/, '$1'));
const sourceRoot = path.resolve(process.argv[2] || process.env.SOURCE_ROOT || path.join(repoRoot, '..', 'dictionnaire-biblique-v2'));
const dataRoot = path.join(repoRoot, 'data');
const version = process.env.RELEASE_VERSION || new Date().toISOString().slice(0, 10).replaceAll('-', '.');
const generatedAt = new Date().toISOString();

const baseSpecs = [
  ['uploads/dictionnaires/concepts.json', 'data/dictionaries/concepts.json', 'json', 'dictionary-index'],
  ['uploads/dictionnaires/concept-entry-links.json', 'data/dictionaries/concept-entry-links.json', 'json', 'dictionary-index'],
  ['uploads/dictionnaires/concept-labels.json', 'data/dictionaries/concept-labels.json', 'json', 'dictionary-index'],
  ['uploads/dictionnaires/concept-meta.json', 'data/dictionaries/concept-meta.json', 'json', 'dictionary-index'],
  ['uploads/dictionnaires/concept-url-slugs.json', 'data/dictionaries/concept-url-slugs.json', 'json', 'dictionary-index'],
  ['uploads/dictionnaires/slug-map.json', 'data/dictionaries/slug-map.json', 'json', 'dictionary-index'],
  ['uploads/dictionnaires/browse-index.json', 'data/dictionaries/browse-index.json', 'json', 'dictionary-index'],
  ['uploads/dictionnaires/search-index.json', 'data/indexes/search-index.json', 'json', 'search'],
  ['uploads/dictionnaires/search-docs.jsonl', 'data/indexes/search-docs.jsonl', 'jsonl', 'search'],
  ['uploads/dictionnaires/bym/bym-lexicon.entries.json', 'data/dictionaries/bym/bym-lexicon.entries.json', 'json', 'dictionary-corpus'],
  ['uploads/dictionnaires/easton/easton.entries.json', 'data/dictionaries/easton/easton.entries.json', 'json', 'dictionary-corpus'],
  ['uploads/dictionnaires/smith/smith.entries.json', 'data/dictionaries/smith/smith.entries.json', 'json', 'dictionary-corpus'],
  ['uploads/dictionnaires/hebrew/hebrew-lexicon-fr-compact.json', 'data/hebrew/hebrew-lexicon-fr-compact.json', 'json', 'hebrew'],
  ['uploads/dictionnaires/strong-to-concepts-index.json', 'data/hebrew/strong-to-concepts-index.json', 'json', 'hebrew'],
  ['uploads/dictionnaires/strong-concordance-oshb.json', 'data/hebrew/strong-concordance-oshb.json', 'json', 'hebrew'],
  ['uploads/dictionnaires/strong-root-families.json', 'data/hebrew/strong-root-families.json', 'json', 'hebrew'],
  ['uploads/dictionnaires/strong-root-families-enriched.json', 'data/hebrew/strong-root-families-enriched.json', 'json', 'hebrew'],
  ['uploads/dictionnaires/concept-strong-map.json', 'data/hebrew/concept-strong-map.json', 'json', 'hebrew'],
  ['uploads/dictionnaires/concept-french-strong-map.json', 'data/hebrew/concept-french-strong-map.json', 'json', 'hebrew'],
  ['uploads/dictionnaires/interlinear/at-search-index.json', 'data/interlinear/at-search-index.json', 'json', 'interlinear']
];

function readUtf8(file) {
  return fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
}
function writeUtf8(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content.replace(/\r\n/g, '\n'), 'utf8');
}
function normalizeJson(source, target) {
  const parsed = JSON.parse(readUtf8(source));
  writeUtf8(target, JSON.stringify(parsed) + '\n');
  return parsed;
}
function normalizeJsonl(source, target) {
  const rows = readUtf8(source).split(/\r?\n/).filter(Boolean).map((line, index) => {
    try { return JSON.parse(line); }
    catch (error) { throw new Error(source + ':' + (index + 1) + ' invalid JSONL: ' + error.message); }
  });
  writeUtf8(target, rows.map((row) => JSON.stringify(row)).join('\n') + '\n');
  return rows;
}
function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}
function recordCount(kind, parsed) {
  if (kind === 'jsonl') return parsed.length;
  if (Array.isArray(parsed)) return parsed.length;
  if (parsed && typeof parsed === 'object') {
    if (Array.isArray(parsed.refs)) return parsed.refs.length;
    if (parsed.docs && Array.isArray(parsed.docs)) return parsed.docs.length;
    return Object.keys(parsed).length;
  }
  return null;
}
function addDirectorySpecs(specs, sourceDir, targetDir, pattern, group) {
  const absolute = path.join(sourceRoot, sourceDir);
  if (!fs.existsSync(absolute)) throw new Error('Missing directory: ' + absolute);
  for (const name of fs.readdirSync(absolute).filter((item) => pattern.test(item)).sort()) {
    specs.push([path.join(sourceDir, name).replaceAll('\\', '/'), path.join(targetDir, name).replaceAll('\\', '/'), 'json', group]);
  }
}

if (!fs.existsSync(sourceRoot)) throw new Error('SOURCE_ROOT not found: ' + sourceRoot);
fs.rmSync(dataRoot, { recursive: true, force: true });

const specs = [...baseSpecs];
addDirectorySpecs(specs, 'uploads/dictionnaires/isbe', 'data/dictionaries/isbe', /^isbe-[A-Z]\.json$/, 'dictionary-corpus');
addDirectorySpecs(specs, 'uploads/dictionnaires/interlinear/at', 'data/interlinear/at', /^[0-9]{2}-.+\.json$/, 'interlinear');

const files = [];
const stats = { files: 0, bytes: 0, by_group: {} };
for (const [sourceRel, targetRel, kind, group] of specs) {
  const source = path.join(sourceRoot, sourceRel);
  const target = path.join(repoRoot, targetRel);
  if (!fs.existsSync(source)) throw new Error('Missing source file: ' + sourceRel);
  const parsed = kind === 'jsonl' ? normalizeJsonl(source, target) : normalizeJson(source, target);
  const stat = fs.statSync(target);
  const item = {
    path: targetRel.replaceAll('\\', '/'),
    source: sourceRel.replaceAll('\\', '/'),
    kind,
    group,
    bytes: stat.size,
    sha256: sha256(target),
    records: recordCount(kind, parsed)
  };
  files.push(item);
  stats.files += 1;
  stats.bytes += stat.size;
  stats.by_group[group] = stats.by_group[group] || { files: 0, bytes: 0, records: 0 };
  stats.by_group[group].files += 1;
  stats.by_group[group].bytes += stat.size;
  if (Number.isFinite(item.records)) stats.by_group[group].records += item.records;
}

const manifest = {
  name: 'alombredufiguier-bible-data',
  version,
  generated_at: generatedAt,
  source_root_hint: path.basename(sourceRoot),
  license: 'CC BY 4.0',
  attribution: 'Donnees bibliques francaises fournies par A l\'ombre du figuier - https://alombredufiguier.org - licence CC BY 4.0.',
  files,
  stats
};
writeUtf8(path.join(repoRoot, 'data/manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
const sums = files.concat([{ path: 'data/manifest.json', sha256: sha256(path.join(repoRoot, 'data/manifest.json')) }])
  .map((item) => item.sha256 + '  ' + item.path)
  .join('\n') + '\n';
writeUtf8(path.join(repoRoot, 'SHA256SUMS.txt'), sums);
console.log('Built public data package');
console.log('source=' + sourceRoot);
console.log('files=' + files.length);
console.log('bytes=' + stats.bytes);
