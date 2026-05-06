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
function findStrong(entries, strong) {
  return Array.isArray(entries) && entries.some((entry) => entry && entry.s === strong);
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
for (const item of manifest.files) {
  const file = path.join(repoRoot, item.path);
  if (!fs.existsSync(file)) fail('Manifest file missing: ' + item.path);
  const stat = fs.statSync(file);
  if (stat.size !== item.bytes) fail('Byte mismatch: ' + item.path);
  if (stat.size > maxBytes) fail('File exceeds 95 MB: ' + item.path);
  const digest = sha256(file);
  if (digest !== item.sha256) fail('SHA-256 mismatch: ' + item.path);
  parseJsonOrJsonl(item.path, item.kind);
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
