#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const repoRoot = path.resolve(new URL('..', import.meta.url).pathname.replace(/^\/(.:\/)/, '$1'));
const maxBytes = 95 * 1024 * 1024;
const bannedPatterns = [
  /(^|\/)\.claude(\/|$)/,
  /(^|\/)\.cowork-ssh(\/|$)/,
  /(^|\/)work(\/|$)/,
  /(^|\/)reports(\/|$)/,
  /(^|\/)scripts(\/|$)/,
  /(^|\/)wp-content(\/|$)/,
  /(^|\/)kadence-child(\/|$)/,
  /(^|\/)\.env/,
  /_archive/i,
  /_bak/i,
  /\.bak/i,
  /\.key$/i,
  /id_rsa/i,
  /ed25519/i
];
function fail(message) { throw new Error(message); }
function readUtf8(file) { return fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''); }
function readJson(rel) { return JSON.parse(readUtf8(path.join(repoRoot, rel))); }
function sha256(file) { return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'); }
function walk(dir, base = dir, out = []) {
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    if (item.name === '.git') continue;
    const full = path.join(dir, item.name);
    const rel = path.relative(base, full).replaceAll('\\', '/');
    if (item.isDirectory()) walk(full, base, out);
    else out.push(rel);
  }
  return out;
}
function parseJsonOrJsonl(rel, kind) {
  const file = path.join(repoRoot, rel);
  if (kind === 'jsonl') {
    return readUtf8(file).split(/\r?\n/).filter(Boolean).map((line, index) => {
      try { return JSON.parse(line); }
      catch (error) { fail(rel + ':' + (index + 1) + ' invalid JSONL: ' + error.message); }
    });
  }
  return readJson(rel);
}
function recordCount(kind, parsed) {
  if (kind === 'jsonl') return parsed.length;
  if (Array.isArray(parsed)) return parsed.length;
  if (parsed && typeof parsed === 'object') {
    if (Array.isArray(parsed.refs)) return parsed.refs.length;
    if (Array.isArray(parsed.docs)) return parsed.docs.length;
    return Object.keys(parsed).length;
  }
  return null;
}
function findStrong(entries, strong) {
  return Array.isArray(entries) && entries.some((entry) => entry && entry.s === strong);
}
function scanStrings(value, visitor, jsonPath = '$') {
  if (typeof value === 'string') {
    visitor(value, jsonPath);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => scanStrings(item, visitor, `${jsonPath}[${index}]`));
    return;
  }
  if (value && typeof value === 'object') {
    for (const [key, inner] of Object.entries(value)) {
      scanStrings(inner, visitor, `${jsonPath}.${key}`);
    }
  }
}
function hasNoText(value) {
  return typeof value !== 'string' || value.trim() === '';
}
const mojibakeMarkers = [
  '\u00c3\u0192',
  '\u00c3\u201a',
  '\u00c3\u00a2\u20ac',
  '\u00e2\u20ac',
  '\u00c2\u00a0',
  '\ufffd'
];
const mixedVisibleRe = /\b(Against|According|Angel Of|Balm Of|Book Of|Brethren|Camel'?S Hair|Chambers|Coming|Cutting Off|Day Of|Floor|Ghost|Goats'? Hair|Heavens|Hosts|Journey|Lake Of|Lord|Middle Wall|Mount Of|New Heavens|Partition|Plucking|Second Coming|Sheep|Signs Of|Threshing|Tower Of|Wall Of)\b/i;
const unreviewedDefinitionRe = /\b(generally rendered|where the word is variously rendered|a different Hebrew word|This is the Version autorisee rendering|Version autorisee rendering|Meaning of the Word|All authorities agree|Old English|Authorized Version|Revised Version|see [A-Z][A-Za-z]+|\(see [A-Z][A-Za-z]+|the Lord|Holy Ghost|Holy Spirit)\b/i;
const reviewedDefinitionPatterns = [
  /King James Version/gi,
  /Version Autorisée King James/gi,
  /King James Version Révisée/gi,
  /American Standard King James Version Revisee/gi,
  /British and American/gi,
  /The Lord's Prayer/gi,
  /They That Fear the Lord/gi,
  /Heb\./gi,
  /Gr\./gi,
  /LXX/gi
];
function stripReviewedDefinitionText(text) {
  return reviewedDefinitionPatterns.reduce((next, pattern) => next.replace(pattern, ''), text);
}

const manifestPath = path.join(repoRoot, 'data/manifest.json');
if (!fs.existsSync(manifestPath)) fail('Missing data/manifest.json. Run tools/build-public-package.mjs first.');
const manifest = readJson('data/manifest.json');
if (!Array.isArray(manifest.files) || manifest.files.length === 0) fail('Manifest has no files.');

const repoFiles = walk(repoRoot);
for (const rel of repoFiles) {
  if (bannedPatterns.some((pattern) => pattern.test(rel))) fail('Forbidden file in public repo: ' + rel);
}

let totalBytes = 0;
const parsedByPath = new Map();
for (const item of manifest.files) {
  const file = path.join(repoRoot, item.path);
  if (!fs.existsSync(file)) fail('Manifest file missing: ' + item.path);
  const stat = fs.statSync(file);
  if (stat.size !== item.bytes) fail('Byte mismatch: ' + item.path);
  if (stat.size > maxBytes) fail('File exceeds 95 MB: ' + item.path);
  const digest = sha256(file);
  if (digest !== item.sha256) fail('SHA-256 mismatch: ' + item.path);
  const parsed = parseJsonOrJsonl(item.path, item.kind);
  parsedByPath.set(item.path, parsed);
  const records = recordCount(item.kind, parsed);
  if (records !== item.records) fail('Record count mismatch: ' + item.path);
  totalBytes += stat.size;
}
if (manifest.stats?.files !== manifest.files.length) fail('Manifest stats.files mismatch.');
if (manifest.stats?.bytes !== totalBytes) fail('Manifest stats.bytes mismatch.');

const hebrew = readJson('data/hebrew/hebrew-lexicon-fr-compact.json');
for (const strong of ['H3034', 'H4714', 'H67', 'H364', 'H7225']) {
  if (!findStrong(hebrew, strong)) fail('Missing Hebrew canary: ' + strong);
}
const slugMap = readJson('data/dictionaries/slug-map.json');
const conceptSlugs = readJson('data/dictionaries/concept-url-slugs.json');
if (slugMap.blanchiment !== 'whitewash' || conceptSlugs.whitewash !== 'blanchiment') fail('Canary failed: whitewash/blanchiment');
if (slugMap['versions-coptes'] !== 'coptic-versions' || conceptSlugs['coptic-versions'] !== 'versions-coptes') fail('Canary failed: versions-coptes');
for (const [conceptId, slug] of Object.entries(conceptSlugs)) {
  if (slugMap[slug] !== conceptId) fail(`Canonical slug is not reversible: ${conceptId} -> ${slug} -> ${slugMap[slug]}`);
}
if (conceptSlugs.archedutemoignage !== 'arche-du-temoignage-isbe' || slugMap['arche-du-temoignage-isbe'] !== 'archedutemoignage') {
  fail('Canary failed: arche-du-temoignage-isbe');
}
for (const [slug, conceptId] of Object.entries({
  iyzebel: 'jezebel',
  mattithyah: 'matthaios',
  matyah: 'matyah',
  loi: 'loi'
})) {
  if (slugMap[slug] !== conceptId) fail(`Canary failed: ${slug} -> ${conceptId}`);
}

const emptyReadyDefinitions = [];
const mixedVisibleLabels = [];
const unreviewedDefinitionResidues = [];
for (const item of manifest.files.filter((entry) => entry.group === 'dictionary-corpus')) {
  const parsed = parsedByPath.get(item.path);
  if (!Array.isArray(parsed)) continue;
  parsed.forEach((entry, index) => {
    if (entry?.status === 'ready' && hasNoText(entry.definition)) {
      emptyReadyDefinitions.push(`${item.path}[${index}] ${entry.id || ''} ${entry.mot || entry.label_fr || ''}`.trim());
    }
    if (typeof entry?.label_fr === 'string' && mixedVisibleRe.test(entry.label_fr)) {
      mixedVisibleLabels.push(`${item.path}[${index}] ${entry.id || ''} label_fr=${entry.label_fr}`.trim());
    }
    if (typeof entry?.definition === 'string' && unreviewedDefinitionRe.test(stripReviewedDefinitionText(entry.definition))) {
      unreviewedDefinitionResidues.push(`${item.path}[${index}] ${entry.id || ''}`.trim());
    }
  });
}
if (emptyReadyDefinitions.length) fail('Ready dictionary entries with empty definition: ' + emptyReadyDefinitions.slice(0, 10).join('; '));
if (mixedVisibleLabels.length) fail('Mixed-language visible dictionary labels: ' + mixedVisibleLabels.slice(0, 10).join('; '));
if (unreviewedDefinitionResidues.length) fail('Unreviewed strong definition residues: ' + unreviewedDefinitionResidues.slice(0, 10).join('; '));

const concepts = readJson('data/dictionaries/concepts.json');
const conceptIds = new Set(concepts.map((concept) => concept.concept_id));
const conceptLinks = readJson('data/dictionaries/concept-entry-links.json');
const orphanLinks = conceptLinks.filter((link) => !conceptIds.has(link.concept_id));
if (orphanLinks.length) fail('Orphan concept links: ' + orphanLinks.slice(0, 10).map((link) => `${link.entry_id}->${link.concept_id}`).join('; '));

const mixedConceptLabels = [];
concepts.forEach((concept, index) => {
  for (const field of ['label', 'label_restore']) {
    if (typeof concept?.[field] === 'string' && mixedVisibleRe.test(concept[field])) {
      mixedConceptLabels.push(`concepts[${index}] ${concept.concept_id}.${field}=${concept[field]}`);
    }
  }
  const display = concept.display_titles || {};
  for (const field of ['primary', 'secondary']) {
    if (typeof display[field] === 'string' && mixedVisibleRe.test(display[field])) {
      mixedConceptLabels.push(`concepts[${index}] ${concept.concept_id}.display_titles.${field}=${display[field]}`);
    }
  }
  const publicForms = concept.public_forms || {};
  for (const field of ['restored_reference', 'french_reference']) {
    if (typeof publicForms[field] === 'string' && mixedVisibleRe.test(publicForms[field])) {
      mixedConceptLabels.push(`concepts[${index}] ${concept.concept_id}.public_forms.${field}=${publicForms[field]}`);
    }
  }
});
if (mixedConceptLabels.length) fail('Mixed-language visible concept labels: ' + mixedConceptLabels.slice(0, 10).join('; '));

const mojibakeHits = [];
for (const [rel, parsed] of parsedByPath) {
  scanStrings(parsed, (text, jsonPath) => {
    const marker = mojibakeMarkers.find((item) => text.includes(item));
    if (marker) mojibakeHits.push(`${rel}${jsonPath} marker=${JSON.stringify(marker)}`);
  });
}
if (mojibakeHits.length) fail('True mojibake markers found: ' + mojibakeHits.slice(0, 10).join('; '));

const bymEntries = readJson('data/dictionaries/bym/bym-lexicon.entries.json');
if (!Array.isArray(bymEntries) || bymEntries.length !== 515) fail('BYM canary failed: expected 515 entries.');
if (bymEntries.some((entry) => JSON.stringify(entry).toUpperCase().includes('LOL'))) fail('BYM canary failed: contains LOL.');
const bymByMot = new Map(bymEntries.map((entry) => [entry.mot, entry]));
for (const [mot, target] of Object.entries({
  TORAH: 'Loi',
  JÉZABEL: 'Iyzebel',
  MATTHIEU: 'Mattithyah',
  MATTHIAS: 'Matyah'
})) {
  const entry = bymByMot.get(mot);
  if (!entry) fail('BYM canary failed: missing ' + mot);
  if (String(entry.redirect_target_label || '').toLocaleLowerCase('fr') !== target.toLocaleLowerCase('fr')) {
    fail(`BYM canary failed: ${mot} redirects to ${entry.redirect_target_label}, expected ${target}`);
  }
}
if (!bymEntries.some((entry) => String(entry.mot || '').startsWith('ALLÉLOU-YAH'))) fail('BYM canary failed: missing ALLÉLOU-YAH.');
const interlinear = readJson('data/interlinear/at-search-index.json');
const strongIndex = interlinear.columns.indexOf('s');
const xIndex = interlinear.columns.indexOf('x');
const gIndex = interlinear.columns.indexOf('g');
if (strongIndex < 0 || !interlinear.refs.some((row) => row[strongIndex] === 'H4714')) fail('Interlinear canary failed: H4714');
const hasMitsrayim = interlinear.refs.some((row) => String(row[xIndex] || '').toLowerCase().includes('mitsrayim') || String(row[gIndex] || '').toLowerCase().includes('mitsrayim'));
if (!hasMitsrayim) fail('Interlinear canary failed: Mitsrayim');

console.log('Release validation OK');
console.log('files=' + manifest.files.length);
console.log('bytes=' + totalBytes);
console.log('version=' + manifest.version);
