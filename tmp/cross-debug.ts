import { mkdirSync, rmSync, writeFileSync, readdirSync, readFileSync } from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { createTextPdfInDir } from '../tests/fixtures/pdf-helpers.js';

const workspace = 'C:\\\\temp\\\\cross-debug';
if (exists(workspace)) rmSync(workspace, { recursive: true, force: true });
mkdirSync(workspace, { recursive: true });

function setupWiki(slug: string, title: string, description: string) {
  const wikiDir = path.join(workspace, 'wikis', slug);
  mkdirSync(path.join(wikiDir, 'raw'), { recursive: true });
  writeFileSync(
    path.join(wikiDir, 'config.json'),
    JSON.stringify({
      wiki: { slug, title, description, version: '1.0' },
      schema: { wiki_index_md: 'index.md', chunking_strategy_md: 'chunking-strategy.md' },
      chunking: { max_chunk_size: 40000, min_chunk_size: 100, split_boundary: 'page', never_split: ['table'], overlap: 0 },
      extraction: { engine: 'pdfjs-dist', ocr_enabled: true, page_range: null },
      output: { dir: '.', page_types: ['index', 'source', 'document', 'topic', 'entity', 'raw'] },
      status: 'ready',
      ingestion: { entity_threshold: 2, topic_threshold: 2, max_entities: 50, max_topics: 50 },
    }, null, 2),
  );
  writeFileSync(path.join(wikiDir, 'index.md'), `# ${title}\\n`);
  return wikiDir;
}

function exists(p: string) {
  try {
    return Boolean(readFileSync(p));
  } catch {
    return false;
  }
}

const wikiDirA = setupWiki('acme', 'Acme Wiki', 'Annual reports for Acme');
const wikiDirB = setupWiki('globex', 'Globex Wiki', 'Filings for Globex');

await createTextPdfInDir(path.join(wikiDirA, 'raw'), 'doc-a.pdf', [{ header: 'Doc A', body: 'Acme Corp reported revenue. Acme Corp is the focus.' }]);
await createTextPdfInDir(path.join(wikiDirB, 'raw'), 'doc-b.pdf', [{ header: 'Doc B', body: 'Acme Corp acquired Globex. Acme Corp is the buyer.' }]);

const CLI = path.resolve('C:\\\\Users\\\\atavi\\\\Projects\\\\Wiki v4', 'dist', 'cli.js');
function run(args: string[]) {
  return execFileSync('node', [CLI, ...args], { cwd: workspace, encoding: 'utf-8', stdio: 'pipe' });
}

console.log(run(['ingest', 'acme']));
console.log(run(['ingest', 'globex']));

console.log('--- acme entities ---');
console.log(readdirSync(path.join(wikiDirA, 'entities')));
console.log('--- globex entities ---');
console.log(readdirSync(path.join(wikiDirB, 'entities')));
console.log('--- index of indexes ---');
console.log(readFileSync(path.join(workspace, 'index-of-indexes.md'), 'utf-8'));
