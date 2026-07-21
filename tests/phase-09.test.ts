import { copyFileSync, existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { afterAll, expect, test } from 'vitest';
import { init } from '../src/commands/init';
import { ingest } from '../src/commands/ingest';
import { materialize } from '../src/materializer';
import { proposeAgentsUpdate } from '../src/agents/agents-updater';
import { readStructuralChanges } from '../src/state/structural-changes';
import type { ChunkExtraction } from '../src/commands/extract-chunk';
import type { ExtractorResult } from '../src/agents/extractor';

/**
 * Phase 9 gates 9.1–9.5 (AGENTS.md Updater). Deterministic and LLM-free:
 * ingest runs against a temp workspace with an injected `extractChunkFn`
 * stub, and the updater's LLM call is injected via `callLLMFn` (per the
 * tests/AGENTS.md contract, the gates' literal live-LLM `ingest` calls are
 * restructured to injected stubs; pass criteria unchanged).
 *
 * Gate 9.1 deviation (recorded in .state/phase-9-status.json): the phase
 * doc's literal section name "Ingest Workflow" does not exist in the Phase 0
 * wiki constitution template; the actual section is "Ingest Instructions for
 * the LLM". The gate asserts the template's actual required sections.
 */

const GOLDEN_MASTER_PDF = 'test-pdfs/golden-master.pdf';
const tempDirs: string[] = [];

afterAll(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

function makeTempDir(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

function fakeExtraction(): ExtractorResult {
  return {
    entities: [
      {
        name: 'John Smith',
        type: 'person',
        slug: 'john-smith',
        folder: 'entities/people/executives',
        significance: 'CEO of Acme Corp',
        mentions: [{ page: 1, context: 'John Smith, CEO of Acme Corp' }],
      },
      {
        name: 'Acme Corp',
        type: 'company',
        slug: 'acme-corp',
        folder: 'entities/companies',
        significance: 'The company whose results are presented',
        mentions: [{ page: 1, context: 'annual results of Acme Corp' }],
      },
    ],
    relationships: [
      {
        subject: 'john-smith',
        predicate: 'is-ceo-of',
        object: 'acme-corp',
        evidence: 'John Smith, CEO of Acme Corp',
        page: 1,
      },
    ],
    claims: [
      {
        text: 'Revenue was $42.5M in Q3 2024',
        type: 'financial',
        entities: ['acme-corp'],
        page: 2,
      },
    ],
    timeline: [],
    context: 'Fake extraction fixture for Phase 9 updater tests.',
  };
}

/** Injected Layer 2 stub: writes the extraction JSON exactly like the real path. */
function makeExtractChunkFnStub(): (wikiDir: string, chunkId: string) => Promise<ChunkExtraction> {
  return async (wikiDir, chunkId) => {
    const result = fakeExtraction();
    const jsonPath = join(wikiDir, '.state', 'extracted', `${chunkId}.json`);
    await mkdir(dirname(jsonPath), { recursive: true });
    await writeFile(jsonPath, JSON.stringify(result, null, 2) + '\n', 'utf-8');
    return {
      chunkId,
      result,
      jsonPath,
      jsonRelativePath: `.state/extracted/${chunkId}.json`,
    };
  };
}

/** Init a wiki, copy the golden master in, and run a full LLM-free ingest. */
async function setupIngestedWiki(): Promise<string> {
  const workspace = makeTempDir('llm-wiki-phase9-');
  await init('test-wiki', { workspace });
  const wikiDir = join(workspace, 'wikis', 'test-wiki');
  copyFileSync(GOLDEN_MASTER_PDF, join(wikiDir, 'raw', 'golden-master.pdf'));
  await ingest('test-wiki', { workspace, extractChunkFn: makeExtractChunkFnStub() });
  return workspace;
}

function wikiPath(workspace: string, ...parts: string[]): string {
  return join(workspace, 'wikis', 'test-wiki', ...parts);
}

// --- Gate 9.1: Updater Proposes Valid AGENTS.md ----------------------------

test('gate 9.1: updater proposes valid AGENTS.md with all required sections', async () => {
  const workspace = await setupIngestedWiki();
  const current = readFileSync(wikiPath(workspace, 'AGENTS.md'), 'utf-8');

  const proposal = await proposeAgentsUpdate('test-wiki', {
    workspace,
    callLLMFn: async () => `${current}\nAdditional folder examples discovered during ingestion.\n`,
  });

  // Pass criterion: the proposal contains all required sections of the wiki
  // constitution (deviation: the phase doc's literal "Ingest Workflow" is the
  // template's "## Ingest Instructions for the LLM" section).
  expect(proposal).toContain('## Folder Structure');
  expect(proposal).toContain('## Page Types');
  expect(proposal).toContain('## Ingest Instructions for the LLM');
  expect(proposal).toContain('## Language');
});

// --- Gate 9.2: Proposal Includes New Folders -------------------------------

test('gate 9.2: proposal includes new folders discovered during ingestion', async () => {
  const workspace = await setupIngestedWiki();

  // Strongest form of the gate: even when the LLM is entirely unavailable,
  // the deterministic fallback proposal must mention every logged new folder.
  const proposal = await proposeAgentsUpdate('test-wiki', {
    workspace,
    callLLMFn: async () => {
      throw new Error('ANTHROPIC_API_KEY is not set (test stub)');
    },
  });

  const changes = JSON.parse(
    readFileSync(wikiPath(workspace, '.state', 'proposals', 'structural-changes.json'), 'utf-8'),
  );
  const newFolderChanges = changes.changes.filter((change: { type: string }) => change.type === 'new-folder');
  expect(newFolderChanges.length).toBeGreaterThan(0);
  for (const change of newFolderChanges) {
    expect(proposal).toContain(change.path);
  }
});

test('gate 9.2b: the LLM prompt carries the current constitution, wiki structure, and discoveries', async () => {
  const workspace = await setupIngestedWiki();
  const current = readFileSync(wikiPath(workspace, 'AGENTS.md'), 'utf-8');
  let seenPrompt = '';

  await proposeAgentsUpdate('test-wiki', {
    workspace,
    callLLMFn: async (prompt) => {
      seenPrompt = prompt;
      return current;
    },
  });

  expect(seenPrompt).toContain(current);
  expect(seenPrompt).toContain('entities/people/executives');
  expect(seenPrompt).toContain('entities/companies');
  expect(seenPrompt).toContain('topics/financial');
  expect(seenPrompt).toContain('person');
  expect(seenPrompt).toContain('company');
});

// --- Gate 9.3: Proposal Is Saved to Disk ------------------------------------

test('gate 9.3: proposal is saved to .state/proposed-agents.md', async () => {
  const workspace = await setupIngestedWiki();
  const current = readFileSync(wikiPath(workspace, 'AGENTS.md'), 'utf-8');

  await proposeAgentsUpdate('test-wiki', {
    workspace,
    callLLMFn: async () => current,
  });

  expect(existsSync(wikiPath(workspace, '.state', 'proposed-agents.md'))).toBe(true);
});

// --- Gate 9.4: Original AGENTS.md Is Not Overwritten ------------------------

test('gate 9.4: original AGENTS.md is not overwritten', async () => {
  const workspace = await setupIngestedWiki();
  const original = readFileSync(wikiPath(workspace, 'AGENTS.md'), 'utf-8');

  await proposeAgentsUpdate('test-wiki', {
    workspace,
    callLLMFn: async () => `${original}\nProposed changes the human has not reviewed yet.\n`,
  });

  const after = readFileSync(wikiPath(workspace, 'AGENTS.md'), 'utf-8');
  expect(after).toBe(original);
});

// --- Gate 9.5: Updater Does Not Run by Default ------------------------------

test('gate 9.5: updater does not run without --update-agents', async () => {
  const workspace = makeTempDir('llm-wiki-phase9-');
  await init('test-wiki', { workspace });
  copyFileSync(GOLDEN_MASTER_PDF, join(workspace, 'wikis', 'test-wiki', 'raw', 'golden-master.pdf'));

  const result = await ingest('test-wiki', { workspace, extractChunkFn: makeExtractChunkFnStub() });

  expect(result.agentsUpdateProposed).toBeUndefined();
  expect(existsSync(wikiPath(workspace, '.state', 'proposed-agents.md'))).toBe(false);
});

test('gate 9.5b: ingest with updateAgents runs the updater after the DOX contracts', async () => {
  const workspace = makeTempDir('llm-wiki-phase9-');
  await init('test-wiki', { workspace });
  copyFileSync(GOLDEN_MASTER_PDF, join(workspace, 'wikis', 'test-wiki', 'raw', 'golden-master.pdf'));

  const calls: string[] = [];
  const result = await ingest('test-wiki', {
    workspace,
    extractChunkFn: makeExtractChunkFnStub(),
    updateAgents: true,
    // Full-wiring stub: delegates to the REAL proposer with an injected
    // LLM-free callLLMFn, so the whole ingest -> updater path is exercised.
    proposeAgentsUpdateFn: async (slug, options) => {
      calls.push(slug);
      const current = readFileSync(wikiPath(workspace, 'AGENTS.md'), 'utf-8');
      return proposeAgentsUpdate(slug, { ...options, callLLMFn: async () => current });
    },
  });

  expect(calls).toEqual(['test-wiki']);
  expect(result.agentsUpdateProposed).toBe(true);
  expect(existsSync(wikiPath(workspace, '.state', 'proposed-agents.md'))).toBe(true);
});

// --- Supplementary: bounded retry + Language-section enforcement ------------

test('supplementary: invalid proposals are retried up to 3 attempts before the fallback', async () => {
  const workspace = await setupIngestedWiki();
  let attempts = 0;

  const proposal = await proposeAgentsUpdate('test-wiki', {
    workspace,
    callLLMFn: async () => {
      attempts++;
      return 'too short — not a constitution';
    },
  });

  expect(attempts).toBe(3);
  expect(proposal).toContain('## Proposed Additions (deterministic fallback)');
  expect(proposal).toContain('entities/people/executives');
});

test('supplementary: the Language section is re-imposed verbatim over the LLM output', async () => {
  const workspace = await setupIngestedWiki();
  const current = readFileSync(wikiPath(workspace, 'AGENTS.md'), 'utf-8');
  const vandalized = current.replace(
    /## Language\n[\s\S]*?(?=\n## )/,
    '## Language\n\nThis wiki now writes everything in Klingon.\n\n',
  );
  expect(vandalized).not.toBe(current);

  const proposal = await proposeAgentsUpdate('test-wiki', {
    workspace,
    callLLMFn: async () => vandalized,
  });

  const sectionOf = (markdown: string): string => {
    const match = markdown.match(/## Language\n[\s\S]*?(?=\n## )/);
    // Trailing blank lines before the next heading are cosmetic; the section
    // CONTENT is what must stay verbatim.
    return match ? match[0].trimEnd() : '';
  };
  expect(sectionOf(proposal)).toBe(sectionOf(current));
  expect(proposal).not.toContain('Klingon');
});

// --- Supplementary: structural change log (vision 03 §5) --------------------

test('supplementary: first materialize logs new folders and new page types with reasons', async () => {
  const workspace = await setupIngestedWiki();
  const log = await readStructuralChanges(wikiPath(workspace));

  const newFolders = log.changes.filter((change) => change.type === 'new-folder');
  const folderPaths = newFolders.map((change) => change.path).sort();
  expect(folderPaths).toEqual(['entities/companies', 'entities/people/executives', 'topics/financial']);
  for (const change of newFolders) {
    expect(change.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(change.reason.length).toBeGreaterThan(0);
  }
  const executives = newFolders.find((change) => change.path === 'entities/people/executives');
  expect(executives?.affectedEntities).toEqual(['john-smith']);

  const newTypes = log.changes.filter((change) => change.type === 'new-page-type');
  expect(newTypes.map((change) => change.path).sort()).toEqual(['company', 'person']);
  expect(log.knownPageTypes).toEqual(['company', 'person']);
});

test('supplementary: re-materializing the same extractions logs nothing new', async () => {
  const workspace = await setupIngestedWiki();
  const before = await readStructuralChanges(wikiPath(workspace));

  await materialize('test-wiki', { workspace });

  const after = await readStructuralChanges(wikiPath(workspace));
  expect(after.changes.length).toBe(before.changes.length);
  expect(after.knownPageTypes).toEqual(before.knownPageTypes);
});

test('supplementary: absent structural change log reads as empty', async () => {
  const workspace = makeTempDir('llm-wiki-phase9-');
  await init('test-wiki', { workspace });
  const log = await readStructuralChanges(wikiPath(workspace));
  expect(log.changes).toEqual([]);
  expect(log.knownPageTypes).toEqual([]);
});
