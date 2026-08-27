import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { afterAll, expect, test, vi } from 'vitest';
import matter from 'gray-matter';
import { init } from '../src/commands/init';
import { ingest, type IngestOptions } from '../src/commands/ingest';
import type { ChunkExtraction } from '../src/commands/extract-chunk';
import type { ExtractorResult } from '../src/agents/extractor';
import type { CurationOutcome } from '../src/agents/curation';
import { parsePatch, validatePatch, applyPatch, type Patch, type PatchValidationContext } from '../src/llm/patch';
import { buildAmendmentRequest, writeAmendment, type AmendmentRequest } from '../src/agents/amendment';
import { evidenceKeysFor, newEvidenceFor } from '../src/materializer';
import { checkPreservation } from '../src/validation/preservation-check';
import { buildCorrectionBlock } from '../src/llm/reask';
import { setModelRouting } from '../src/llm/client';
import { readSynthesisReport } from '../src/state/synthesis-report';
import { amendmentLogPath } from '../src/state/amendment-log';
import { buildCitationMap, type EntityPageData } from '../src/pages/entity-page';
import type { TopicPageData } from '../src/pages/topic-page';

/**
 * Phase 26 gates 26.1–26.11 (per-PDF sequential ingestion with patch
 * amendment, Option B Patch; canon: vision `04` §1 + §3.2 Step 9/§4,
 * user-ratified 2026-08-26). Every gate except 26.11 is LLM-free:
 * patch parse/validate/apply, amendment eligibility/delta, reask,
 * fallback-to-synthesis, merge-survivor veto, amendment log, and metrics are
 * all deterministic or exercised through injected stubs.
 *
 * Gate 26.2 replays the frozen Phase-26 golden snapshot byte-for-byte to
 * prove the first-PDF path is unchanged by the per-PDF restructure.
 *
 * Gate 26.11 is the ONE live call gate; it is conditionally skipped in the
 * key-less suite so the profile stays $0.
 */

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

function wikiPath(workspace: string, ...parts: string[]): string {
  return join(workspace, 'wikis', 'test-wiki', ...parts);
}

const GOLDEN_MASTER_PDF = 'test-pdfs/golden-master.pdf';
const PINNED = new Date('2026-08-27T10:00:00.000Z');
const SNAPSHOT_DIR = join(import.meta.dirname, 'snapshots', 'phase-26-golden');

function setupWiki(): string {
  const workspace = makeTempDir('paper-chase-g26-');
  init('test-wiki', { workspace });
  return workspace;
}

function setupWikiWithPdfs(fileNames: string[]): string {
  const workspace = setupWiki();
  const rawDir = wikiPath(workspace, 'raw');
  mkdirSync(rawDir, { recursive: true });
  for (const fileName of fileNames) {
    copyFileSync(GOLDEN_MASTER_PDF, join(rawDir, fileName));
  }
  return workspace;
}

function keepAllOutcome(): CurationOutcome {
  return { decisions: { merges: [], drops: [], keep: [] }, attempts: 1, fallbacks: [], vetoes: [] };
}

const KEEP_ALL_STUBS = {
  curateTopicsFn: async () => keepAllOutcome(),
  curateEntitiesFn: async () => keepAllOutcome(),
};

function makeExtractChunkFnStub(byChunk: Record<string, ExtractorResult>) {
  return async (wikiDir: string, chunkId: string): Promise<ChunkExtraction> => {
    const extraction = byChunk[chunkId];
    if (!extraction) {
      throw new Error(`unexpected chunk ${chunkId}`);
    }
    const jsonPath = join(wikiDir, '.state', 'extracted', `${chunkId}.json`);
    mkdirSync(dirname(jsonPath), { recursive: true });
    writeFileSync(jsonPath, JSON.stringify(extraction, null, 2) + '\n', 'utf-8');
    return {
      chunkId,
      result: extraction,
      jsonPath,
      jsonRelativePath: `.state/extracted/${chunkId}.json`,
    };
  };
}

function snapshotTree(root: string, base = root): Map<string, string> {
  const out = new Map<string, string>();
  for (const entry of readdirSync(root, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const full = join(root, entry.name);
    if (entry.isDirectory()) {
      for (const [path, bytes] of snapshotTree(full, base)) {
        out.set(path, bytes);
      }
    } else if (entry.isFile() && statSync(full).isFile()) {
      if (full.toLowerCase().endsWith('.pdf')) {
        continue;
      }
      out.set(relative(base, full).split('\\').join('/'), readFileSync(full, 'utf-8'));
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Shared synthesis stubs (deterministic, preservation-passing)
// ---------------------------------------------------------------------------

function citationMarker(
  data: {
    mentions: Array<{ page?: number; context?: string; source: string; pages: string }>;
    relationships: Array<{ source: string; pages: string }>;
    claims: Array<{ text?: string; type?: string; entities?: string[]; page?: number; source: string; pages: string }>;
    incomingRelationships?: Array<{ source: string; pages: string }>;
  },
  source: string,
  pages: string,
): string {
  const { citationMap } = buildCitationMap(data as unknown as Parameters<typeof buildCitationMap>[0]);
  const index = citationMap.get(`${source}|${pages}`);
  if (index === undefined) {
    throw new Error(`Citation map missing entry for ${source} pages ${pages}`);
  }
  return `[^src${index}]`;
}

function passingEntityPage(data: EntityPageData): string {
  const lines: string[] = [`Synthesis prose for ${data.title}.`, ''];
  if (data.mentions.length > 0) {
    lines.push('## Mentions');
    for (const mention of data.mentions) {
      lines.push(`- Page ${mention.page}: "${mention.context}" ${citationMarker(data, mention.source, mention.pages)}`);
    }
    lines.push('');
  }
  const relationships = [
    ...data.relationships,
    ...(data.incomingRelationships ?? []),
  ];
  if (relationships.length > 0) {
    lines.push('## Relationships');
    for (const relationship of relationships) {
      lines.push(`- ${relationship.evidence} ${citationMarker(data, relationship.source, relationship.pages)}`);
    }
    lines.push('');
  }
  if (data.claims.length > 0) {
    lines.push('## Claims');
    for (const claim of data.claims) {
      lines.push(`- ${claim.text} ${citationMarker(data, claim.source, claim.pages)}`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

function passingTopicPage(data: TopicPageData): string {
  const lines: string[] = [`Topic synthesis for ${data.title}.`, ''];
  if (data.claims.length > 0) {
    lines.push('## Claims');
    for (const claim of data.claims) {
      lines.push(`- ${claim.text} ${citationMarker({ mentions: [], relationships: [], claims: data.claims }, claim.source, claim.pages)}`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Shared fixtures — a simple two-year Alpha Corp corpus
// ---------------------------------------------------------------------------

const REPORT_2023 = 'report-2023.pdf';
const REPORT_2024 = 'report-2024.pdf';

function base2023Extraction(): ExtractorResult {
  return {
    entities: [
      {
        name: 'Alpha Corp',
        type: 'organization',
        slug: 'alpha-corp',
        folder: 'entities/organizations',
        significance: 'The fixture survivor.',
        mentions: [
          { page: 1, context: 'Alpha Corp led the consortium bid' },
          { page: 2, context: 'The Alpha Corp board met twice' },
        ],
      },
      {
        name: 'Jane Doe',
        type: 'person',
        slug: 'jane-doe',
        folder: 'entities/people',
        significance: 'Alpha Corp CEO.',
        mentions: [{ page: 2, context: 'Jane Doe chairs the Alpha Corp board' }],
      },
    ],
    relationships: [
      {
        subject: 'jane-doe',
        predicate: 'is-ceo-of',
        object: 'alpha-corp',
        evidence: 'Jane Doe chairs the Alpha Corp board',
        page: 2,
      },
    ],
    claims: [
      {
        text: 'Alpha Corp revenue was 100M',
        type: 'financial',
        entities: ['alpha-corp'],
        page: 3,
      },
    ],
    timeline: [],
    context: 'Phase 26 fixture 2023.',
  };
}

function delta2024Extraction(): ExtractorResult {
  return {
    entities: [
      {
        name: 'Alpha Corp',
        type: 'organization',
        slug: 'alpha-corp',
        folder: 'entities/organizations',
        significance: 'The fixture survivor.',
        mentions: [{ page: 1, context: 'Alpha Corp expanded into Europe' }],
      },
    ],
    relationships: [],
    claims: [
      {
        text: 'Alpha Corp revenue was 90M',
        type: 'operational',
        entities: ['alpha-corp'],
        page: 2,
      },
    ],
    timeline: [],
    context: 'Phase 26 fixture 2024.',
  };
}

function unrelated2024Extraction(): ExtractorResult {
  return {
    entities: [
      {
        name: 'Gamma Inc',
        type: 'organization',
        slug: 'gamma-inc',
        folder: 'entities/organizations',
        significance: 'Unrelated entity.',
        mentions: [{ page: 1, context: 'Gamma Inc is unrelated' }],
      },
    ],
    relationships: [],
    claims: [],
    timeline: [],
    context: 'Phase 26 fixture 2024 unrelated.',
  };
}

function mergeBeta2024Extraction(): ExtractorResult {
  return {
    entities: [
      {
        name: 'Beta Corp',
        type: 'organization',
        slug: 'beta-corp',
        folder: 'entities/organizations',
        significance: 'The merger survivor.',
        mentions: [{ page: 1, context: 'Beta Corp acquired Alpha assets' }],
      },
    ],
    relationships: [],
    claims: [
      {
        text: 'Beta Corp revenue was 50M',
        type: 'financial',
        entities: ['beta-corp'],
        page: 2,
      },
    ],
    timeline: [],
    context: 'Phase 26 fixture 2024 beta.',
  };
}

function baseWithBetaExtraction(): ExtractorResult {
  const base = base2023Extraction();
  return {
    ...base,
    // The jane-doe→alpha relationship and the alpha-corp claim carry the
    // merged-away slug; the merge's reference remap would otherwise create
    // spurious amendment deltas on jane-doe/financial (the survivor veto is
    // the only amendment-relevant effect this gate tests).
    relationships: [],
    claims: [],
    entities: [
      ...base.entities,
      {
        name: 'Beta Corp',
        type: 'organization',
        slug: 'beta-corp',
        folder: 'entities/organizations',
        significance: 'The merger survivor.',
        mentions: [{ page: 1, context: 'Beta Corp is a partner' }],
      },
    ],
    context: 'Phase 26 fixture 2023 with beta.',
  };
}

// ---------------------------------------------------------------------------
// Gate 26.1 (unit): patch parse, validate, and apply over the closed vocabulary
// ---------------------------------------------------------------------------

test('gate 26.1 (unit): add-evidence appends under an existing section', () => {
  const page = [
    '# Alpha Corp',
    '',
    '## Mentions',
    '',
    '- Page 1: "Alpha Corp led" [^src1]',
    '',
    '## Sources',
    '',
    '[^src1]: report-2023.pdf, pages 1-3',
    '',
  ].join('\n');
  const patch: Patch = {
    operations: [
      {
        op: 'add-evidence',
        section: '## Mentions',
        items: ['- Page 2: "Alpha Corp expanded" [^src2]'],
      },
    ],
  };
  const validation = validatePatch(patch, { pageContent: page, pageKind: 'entity' });
  expect(validation.valid).toBe(true);
  const merged = applyPatch(page, patch);
  expect(merged).toContain('- Page 2: "Alpha Corp expanded" [^src2]');
  expect(merged).toContain('- Page 1: "Alpha Corp led" [^src1]');
});

test('gate 26.1 (unit): flag-contradiction inserts a marked block without deleting the older claim', () => {
  const page = [
    '# Alpha Corp',
    '',
    '## Claims',
    '',
    '- Alpha Corp revenue was 100M [^src1]',
    '',
    '## Sources',
    '',
    '[^src1]: report-2023.pdf, pages 1-3',
    '',
  ].join('\n');
  const patch: Patch = {
    operations: [
      {
        op: 'flag-contradiction',
        section: '## Claims',
        olderClaim: 'Alpha Corp revenue was 100M',
        olderCitation: '[^src1]',
        newerClaim: 'Alpha Corp revenue was 90M',
        newerCitation: '[^src2]',
      },
    ],
  };
  const validation = validatePatch(patch, { pageContent: page, pageKind: 'entity' });
  expect(validation.valid).toBe(true);
  const merged = applyPatch(page, patch);
  expect(merged).toContain('- Alpha Corp revenue was 100M [^src1]');
  expect(merged).toContain('> **Newer claim:** "Alpha Corp revenue was 90M" [^src2]');
});

test('gate 26.1 (unit): edit-prose replaces a unique existing span', () => {
  const page = ['# Alpha Corp', '', 'Alpha Corp is a fixture.', '', '## Sources', '', ''].join('\n');
  const patch: Patch = {
    operations: [
      {
        op: 'edit-prose',
        oldText: 'Alpha Corp is a fixture.',
        newText: 'Alpha Corp is a fixture that grew.',
      },
    ],
  };
  const validation = validatePatch(patch, { pageContent: page, pageKind: 'entity' });
  expect(validation.valid).toBe(true);
  expect(applyPatch(page, patch)).toContain('Alpha Corp is a fixture that grew.');
});

test('gate 26.1 (unit): add-member extends a composite page and validates coverage', () => {
  const page = [
    '# Indikator 2',
    '',
    '## Members',
    '',
    '- **DPD meaning** (`dpd-meaning`)',
    '',
    '## Mentions',
    '',
    '### DPD meaning',
    '',
    '- DPD mention',
    '',
    '## Sources',
    '',
    '[^src1]: DPD_2025.pdf, pages 1-3',
    '',
  ].join('\n');
  const patch: Patch = {
    operations: [
      {
        op: 'add-member',
        member: { slug: 'hofter-meaning', title: 'HOFTER meaning' },
        sections: [
          {
            section: '## Mentions',
            items: ['- HOFTER mention'],
          },
        ],
      },
    ],
  };
  const allowed = validatePatch(patch, {
    pageContent: page,
    pageKind: 'composite',
    members: [
      { slug: 'dpd-meaning', title: 'DPD meaning' },
      { slug: 'hofter-meaning', title: 'HOFTER meaning' },
    ],
  });
  expect(allowed.valid).toBe(true);
  const merged = applyPatch(page, patch);
  expect(merged).toContain('- **HOFTER meaning** (`hofter-meaning`)');
  expect(merged).toContain('### HOFTER meaning');

  const uncovered = validatePatch(patch, {
    pageContent: page,
    pageKind: 'composite',
    members: [{ slug: 'dpd-meaning', title: 'DPD meaning' }],
  });
  expect(uncovered.valid).toBe(false);
  expect(uncovered.errors[0]).toContain('not covered by the composite\'s current members');
});

test('gate 26.1 (unit): unknown operations and invalid anchors are rejected', () => {
  const page = ['# Alpha', '', '## Mentions', '', '- item', '', '## Sources', '', ''].join('\n');
  const unknown = validatePatch(
    { operations: [{ op: 'delete-evidence' } as unknown as { op: 'add-evidence'; section: string; items: string[] }] },
    { pageContent: page, pageKind: 'entity' },
  );
  expect(unknown.valid).toBe(false);
  expect(unknown.errors[0]).toContain('unknown operation');

  const badAnchor = validatePatch(
    { operations: [{ op: 'add-evidence', section: '## Missing', items: ['- item'] }] },
    { pageContent: page, pageKind: 'entity' },
  );
  expect(badAnchor.valid).toBe(false);
  expect(badAnchor.errors[0]).toContain('no section with this exact heading exists');
});

test('gate 26.1 (unit): parsePatch tolerates markdown fences', () => {
  const raw = '```json\n{ "operations": [] }\n```';
  const { patch, errors } = parsePatch(raw);
  expect(errors).toHaveLength(0);
  expect(patch?.operations).toEqual([]);
});

// ---------------------------------------------------------------------------
// Gate 26.2 (ingest): first-PDF path byte-matches the frozen golden snapshot
// ---------------------------------------------------------------------------

test('gate 26.2 (ingest): single-PDF output matches the phase-26 golden snapshot', { timeout: 120_000 }, async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(PINNED);

  const workspace = setupWikiWithPdfs(['golden-master.pdf']);
  const result = await ingest('test-wiki', {
    workspace,
    synthesis: true,
    poolStaggerMs: 0,
    ...KEEP_ALL_STUBS,
    extractChunkFn: makeExtractChunkFnStub({
      'golden-master-part-001': goldenFixtureExtraction(),
    }),
    synthesizeEntityFn: async (data) => passingEntityPage(data),
    synthesizeEntityPermissiveFn: async (data) => passingEntityPage(data),
    synthesizeTopicFn: async (data) => passingTopicPage(data),
    synthesizeTopicPermissiveFn: async (data) => passingTopicPage(data),
  });

  expect(result.ingested).toHaveLength(1);
  expect(result.synthesized).toBe(2);

  const generated = snapshotTree(wikiPath(workspace));
  const golden = snapshotTree(SNAPSHOT_DIR);

  const generatedKeys = Array.from(generated.keys()).sort();
  const goldenKeys = Array.from(golden.keys()).sort();
  expect(generatedKeys).toEqual(goldenKeys);

  const mismatches: string[] = [];
  for (const key of goldenKeys) {
    const a = generated.get(key) ?? '';
    const b = golden.get(key) ?? '';
    if (a !== b) {
      mismatches.push(key);
    }
  }
  if (mismatches.length > 0) {
    const first = mismatches[0];
    expect(generated.get(first)).toBe(golden.get(first));
  }
});

// ---------------------------------------------------------------------------
// Gate 26.3 (ingest): empty delta keeps the existing page skip-eligible — no patch
// ---------------------------------------------------------------------------

test('gate 26.3 (ingest): unchanged evidence keeps the page skip-eligible and suppresses amendment', { timeout: 120_000 }, async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(PINNED);

  const workspace = setupWikiWithPdfs([REPORT_2023, REPORT_2024]);
  const amendmentCalls: AmendmentRequest[] = [];

  await ingest('test-wiki', {
    workspace,
    synthesis: true,
    poolStaggerMs: 0,
    ...KEEP_ALL_STUBS,
    extractChunkFn: makeExtractChunkFnStub({
      'report-2023-part-001': base2023Extraction(),
      'report-2024-part-001': unrelated2024Extraction(),
    }),
    synthesizeEntityFn: async (data) => passingEntityPage(data),
    synthesizeEntityPermissiveFn: async (data) => passingEntityPage(data),
    synthesizeTopicFn: async (data) => passingTopicPage(data),
    synthesizeTopicPermissiveFn: async (data) => passingTopicPage(data),
    amendmentFn: async (request) => {
      amendmentCalls.push(request);
      return '{ "operations": [] }';
    },
  });

  const alphaPage = readFileSync(wikiPath(workspace, 'entities', 'organizations', 'alpha-corp.md'), 'utf-8');
  expect(alphaPage).toContain('Synthesis prose for Alpha Corp');
  expect(amendmentCalls).toHaveLength(0);
});

// ---------------------------------------------------------------------------
// Gate 26.4 (ingest): non-empty delta routes to the Amendment Writer with exact new evidence
// ---------------------------------------------------------------------------

test('gate 26.4 (ingest): non-empty new evidence is patched, not re-synthesized', { timeout: 120_000 }, async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(PINNED);

  const workspace = setupWikiWithPdfs([REPORT_2023, REPORT_2024]);
  const amendmentCalls: AmendmentRequest[] = [];
  const synthesisCalls: string[] = [];

  const patchOperations = [
    {
      op: 'add-evidence',
      section: '## Mentions',
      items: ['- Page 1: "Alpha Corp expanded into Europe" [^src2]'],
    },
    {
      op: 'flag-contradiction',
      section: '## Claims',
      olderClaim: 'Alpha Corp revenue was 100M',
      olderCitation: '[^src1]',
      newerClaim: 'Alpha Corp revenue was 90M',
      newerCitation: '[^src2]',
    },
  ];

  await ingest('test-wiki', {
    workspace,
    synthesis: true,
    poolStaggerMs: 0,
    ...KEEP_ALL_STUBS,
    extractChunkFn: makeExtractChunkFnStub({
      'report-2023-part-001': base2023Extraction(),
      'report-2024-part-001': delta2024Extraction(),
    }),
    synthesizeEntityFn: async (data) => {
      synthesisCalls.push(data.slug);
      return passingEntityPage(data);
    },
    synthesizeEntityPermissiveFn: async (data) => passingEntityPage(data),
    synthesizeTopicFn: async (data) => passingTopicPage(data),
    synthesizeTopicPermissiveFn: async (data) => passingTopicPage(data),
    amendmentFn: async (request) => {
      amendmentCalls.push(request);
      if (request.pageSlug !== 'alpha-corp') {
        return JSON.stringify({ operations: [] });
      }
      return JSON.stringify({ operations: patchOperations });
    },
  });

  const extractedDir = wikiPath(workspace, '.state', 'extracted');
  const extractedFiles = existsSync(extractedDir) ? readdirSync(extractedDir).sort().join(', ') : '<none>';
  const debug2024 = readFileSync(wikiPath(workspace, '.state', 'extracted', 'report-2024-part-001.json'), 'utf-8');
  const debugState = readFileSync(wikiPath(workspace, '.state', 'synthesis-state.json'), 'utf-8');
  const debugAlphaPage = readFileSync(wikiPath(workspace, 'entities', 'organizations', 'alpha-corp.md'), 'utf-8');
  const debugReport = readFileSync(wikiPath(workspace, '.state', 'synthesis-report.json'), 'utf-8');
  expect(amendmentCalls.length, `extracted=[${extractedFiles}]\n\n2024=${debug2024}\n\nstate=${debugState}\n\nalphaPage=${debugAlphaPage}\n\nreport=${debugReport}`).toBe(1);
  const request = amendmentCalls[0];
  expect(request.pageSlug).toBe('alpha-corp');
  expect(request.newEvidence).toContain('Alpha Corp expanded into Europe');
  expect(request.newEvidence).toContain('Alpha Corp revenue was 90M');
  expect(request.newEvidence).not.toContain('Alpha Corp led the consortium bid');
  expect(request.newEvidence).not.toContain('Jane Doe');

  expect(synthesisCalls.filter((slug) => slug === 'alpha-corp').length).toBe(1);

  const alphaPage = readFileSync(wikiPath(workspace, 'entities', 'organizations', 'alpha-corp.md'), 'utf-8');
  expect(alphaPage).toContain('Alpha Corp expanded into Europe');
  expect(alphaPage).toContain('> **Newer claim:** "Alpha Corp revenue was 90M" [^src2]');
  expect(alphaPage).toContain('Alpha Corp revenue was 100M');

  const report = await readSynthesisReport(wikiPath(workspace));
  const alphaEntries = report.entries.filter((entry) => entry.slug === 'alpha-corp');
  expect(alphaEntries[alphaEntries.length - 1]?.finalMode).toBe('patch-amended');
});

// ---------------------------------------------------------------------------
// Gate 26.5 (ingest): validator feedback re-asks a broken patch
// ---------------------------------------------------------------------------

test('gate 26.5 (ingest): invalid patch is re-asked with validator feedback, then lands', { timeout: 120_000 }, async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(PINNED);

  const workspace = setupWikiWithPdfs([REPORT_2023, REPORT_2024]);
  const amendmentCalls: AmendmentRequest[] = [];
  const feedbackBlocks: Array<string | undefined> = [];
  let callCount = 0;
  const validPatch = JSON.stringify({
    operations: [
      {
        op: 'add-evidence',
        section: '## Mentions',
        items: ['- Page 1: "Alpha Corp expanded into Europe" [^src2]'],
      },
      {
        op: 'flag-contradiction',
        section: '## Claims',
        olderClaim: 'Alpha Corp revenue was 100M',
        olderCitation: '[^src1]',
        newerClaim: 'Alpha Corp revenue was 90M',
        newerCitation: '[^src2]',
      },
    ],
  });

  await ingest('test-wiki', {
    workspace,
    synthesis: true,
    poolStaggerMs: 0,
    ...KEEP_ALL_STUBS,
    extractChunkFn: makeExtractChunkFnStub({
      'report-2023-part-001': base2023Extraction(),
      'report-2024-part-001': delta2024Extraction(),
    }),
    synthesizeEntityFn: async (data) => passingEntityPage(data),
    synthesizeEntityPermissiveFn: async (data) => passingEntityPage(data),
    synthesizeTopicFn: async (data) => passingTopicPage(data),
    synthesizeTopicPermissiveFn: async (data) => passingTopicPage(data),
    amendmentFn: async (request, _agentsMd, _logPath, _language, feedback) => {
      amendmentCalls.push(request);
      feedbackBlocks.push(feedback);
      callCount += 1;
      return callCount === 1 ? '{ operations: [] }' : validPatch;
    },
  });

  expect(callCount).toBe(2);
  expect(feedbackBlocks[1]).toContain('=== CORRECTION REQUIRED ===');

  const report = await readSynthesisReport(wikiPath(workspace));
  const alphaEntries = report.entries.filter((entry) => entry.slug === 'alpha-corp');
  expect(alphaEntries[alphaEntries.length - 1]?.finalMode).toBe('patch-amended');
});

// ---------------------------------------------------------------------------
// Gate 26.6 (ingest): exhausted patch falls back to normal full synthesis, never half-patched
// ---------------------------------------------------------------------------

test('gate 26.6 (ingest): exhausted amendment falls back to full synthesis', { timeout: 120_000 }, async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(PINNED);

  const workspace = setupWikiWithPdfs([REPORT_2023, REPORT_2024]);
  const synthesisCalls: string[] = [];

  await ingest('test-wiki', {
    workspace,
    synthesis: true,
    poolStaggerMs: 0,
    ...KEEP_ALL_STUBS,
    extractChunkFn: makeExtractChunkFnStub({
      'report-2023-part-001': base2023Extraction(),
      'report-2024-part-001': delta2024Extraction(),
    }),
    synthesizeEntityFn: async (data) => {
      synthesisCalls.push(data.slug);
      return passingEntityPage(data);
    },
    synthesizeEntityPermissiveFn: async (data) => passingEntityPage(data),
    synthesizeTopicFn: async (data) => passingTopicPage(data),
    synthesizeTopicPermissiveFn: async (data) => passingTopicPage(data),
    amendmentFn: async () => '{ operations: [] }',
  });

  expect(synthesisCalls).toContain('alpha-corp');

  const report = await readSynthesisReport(wikiPath(workspace));
  const alphaEntry = report.entries.find((entry) => entry.slug === 'alpha-corp');
  expect(alphaEntry?.finalMode).toBe('strict-synthesis');
});

// ---------------------------------------------------------------------------
// Gate 26.7 (unit): composite add-member amendment shape is enforced
// ---------------------------------------------------------------------------

test('gate 26.7 (unit): add-member is only valid on composite pages and only for covered members', () => {
  const page = ['# Composite', '', '## Members', '', '- **A** (`a`)', '', '## Sources', '', ''].join('\n');
  const patch: Patch = {
    operations: [
      {
        op: 'add-member',
        member: { slug: 'b', title: 'B' },
        sections: [{ section: '## Mentions', items: ['- mention'] }],
      },
    ],
  };
  const entityCtx: PatchValidationContext = { pageContent: page, pageKind: 'entity' };
  expect(validatePatch(patch, entityCtx).valid).toBe(false);

  const compositeOk: PatchValidationContext = {
    pageContent: page,
    pageKind: 'composite',
    members: [
      { slug: 'a', title: 'A' },
      { slug: 'b', title: 'B' },
    ],
  };
  const ok = validatePatch(patch, compositeOk);
  expect(ok.valid).toBe(true);
  const merged = applyPatch(page, patch);
  expect(merged).toContain('## Mentions');
  expect(merged).toContain('### B');
  expect(merged).toContain('- mention');
});

// ---------------------------------------------------------------------------
// Gate 26.8 (ingest): a curation-merge survivor that absorbed a synthesized page is vetoed from patching
// ---------------------------------------------------------------------------

test('gate 26.8 (ingest): merge survivor absorbing a synthesized page takes full synthesis, not a patch', { timeout: 120_000 }, async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(PINNED);

  const workspace = setupWikiWithPdfs([REPORT_2023, REPORT_2024]);
  const amendmentCalls: AmendmentRequest[] = [];
  const synthesisSlugs: string[] = [];
  let entityCurationCalls = 0;

  await ingest('test-wiki', {
    workspace,
    synthesis: true,
    poolStaggerMs: 0,
    curateTopicsFn: async () => keepAllOutcome(),
    curateEntitiesFn: async () => {
      entityCurationCalls += 1;
      if (entityCurationCalls === 1) {
        // PDF 1: both entities are synthesized with their own records, so the
        // PDF-2 merge can absorb a SYNTHESIZED page.
        return keepAllOutcome();
      }
      return {
        decisions: { merges: [{ from: ['alpha-corp'], into: 'beta-corp' }], drops: [], keep: [] },
        attempts: 1,
        fallbacks: [],
        vetoes: [],
      };
    },
    extractChunkFn: makeExtractChunkFnStub({
      'report-2023-part-001': baseWithBetaExtraction(),
      'report-2024-part-001': mergeBeta2024Extraction(),
    }),
    synthesizeEntityFn: async (data) => {
      synthesisSlugs.push(data.slug);
      return passingEntityPage(data);
    },
    synthesizeEntityPermissiveFn: async (data) => passingEntityPage(data),
    synthesizeTopicFn: async (data) => passingTopicPage(data),
    synthesizeTopicPermissiveFn: async (data) => passingTopicPage(data),
    amendmentFn: async (request) => {
      amendmentCalls.push(request);
      return '{ "operations": [] }';
    },
  });

  expect(amendmentCalls).toHaveLength(0);
  expect(synthesisSlugs).toContain('beta-corp');
  expect(existsSync(wikiPath(workspace, 'entities', 'organizations', 'alpha-corp.md'))).toBe(false);
  expect(existsSync(wikiPath(workspace, 'entities', 'organizations', 'beta-corp.md'))).toBe(true);
});

// ---------------------------------------------------------------------------
// Gate 26.9 (ingest): every patch lands one amendment-log episode
// ---------------------------------------------------------------------------

test('gate 26.9 (ingest): successful patch writes one amendment-log record', { timeout: 120_000 }, async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(PINNED);

  const workspace = setupWikiWithPdfs([REPORT_2023, REPORT_2024]);
  const patchOperations = [
    {
      op: 'add-evidence',
      section: '## Mentions',
      items: ['- Page 1: "Alpha Corp expanded into Europe" [^src2]'],
    },
    {
      op: 'flag-contradiction',
      section: '## Claims',
      olderClaim: 'Alpha Corp revenue was 100M',
      olderCitation: '[^src1]',
      newerClaim: 'Alpha Corp revenue was 90M',
      newerCitation: '[^src2]',
    },
  ];

  await ingest('test-wiki', {
    workspace,
    synthesis: true,
    poolStaggerMs: 0,
    ...KEEP_ALL_STUBS,
    extractChunkFn: makeExtractChunkFnStub({
      'report-2023-part-001': base2023Extraction(),
      'report-2024-part-001': delta2024Extraction(),
    }),
    synthesizeEntityFn: async (data) => passingEntityPage(data),
    synthesizeEntityPermissiveFn: async (data) => passingEntityPage(data),
    synthesizeTopicFn: async (data) => passingTopicPage(data),
    synthesizeTopicPermissiveFn: async (data) => passingTopicPage(data),
    amendmentFn: async () => JSON.stringify({ operations: patchOperations }),
  });

  const logRaw = readFileSync(amendmentLogPath(wikiPath(workspace)), 'utf-8').trim();
  const lines = logRaw.split('\n').filter((line) => line.trim() !== '');
  expect(lines).toHaveLength(1);
  const record = JSON.parse(lines[0]);
  expect(record.page).toBe('entities/organizations/alpha-corp.md');
  expect(record.pdf).toBe(REPORT_2024);
  expect(record.outcome).toBe('patched');
  expect(record.operations['add-evidence']).toBe(1);
  expect(record.operations['flag-contradiction']).toBe(1);
  expect(record.cause).toBeNull();
});

// ---------------------------------------------------------------------------
// Gate 26.10 (ingest): patchedPages and patchFallbacks surface in result and metrics
// ---------------------------------------------------------------------------

test('gate 26.10 (ingest): metrics count patched pages and patch fallbacks', { timeout: 120_000 }, async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(PINNED);

  const workspace = setupWikiWithPdfs([REPORT_2023, REPORT_2024]);

  const patched = await ingest('test-wiki', {
    workspace,
    synthesis: true,
    poolStaggerMs: 0,
    ...KEEP_ALL_STUBS,
    extractChunkFn: makeExtractChunkFnStub({
      'report-2023-part-001': base2023Extraction(),
      'report-2024-part-001': delta2024Extraction(),
    }),
    synthesizeEntityFn: async (data) => passingEntityPage(data),
    synthesizeEntityPermissiveFn: async (data) => passingEntityPage(data),
    synthesizeTopicFn: async (data) => passingTopicPage(data),
    synthesizeTopicPermissiveFn: async (data) => passingTopicPage(data),
    amendmentFn: async () =>
      JSON.stringify({
        operations: [
          {
            op: 'add-evidence',
            section: '## Mentions',
            items: ['- Page 1: "Alpha Corp expanded into Europe" [^src2]'],
          },
          {
            op: 'flag-contradiction',
            section: '## Claims',
            olderClaim: 'Alpha Corp revenue was 100M',
            olderCitation: '[^src1]',
            newerClaim: 'Alpha Corp revenue was 90M',
            newerCitation: '[^src2]',
          },
        ],
      }),
  });

  expect(patched.patchedPages).toBe(1);
  expect(patched.patchFallbacks).toBe(0);

  const metrics = JSON.parse(readFileSync(wikiPath(workspace, '.state', 'metrics.json'), 'utf-8'));
  expect(metrics.patchedPages).toBe(1);
  expect(metrics.patchFallbacks).toBe(0);
});

// ---------------------------------------------------------------------------
// Gate 26.1 (doc): the per-PDF loop order — extract → materialize (curation
// pair) → synthesize-or-AMEND per PDF, DOX deferred to after the loop
// ---------------------------------------------------------------------------

test('gate 26.1 (loop order): three PDFs process strictly sequentially — curation 3×, synthesis per PDF, DOX once after the loop', { timeout: 120_000 }, async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(PINNED);

  const workspace = setupWikiWithPdfs(['report-2023.pdf', 'report-2024.pdf', 'report-2025.pdf']);
  const events: string[] = [];

  await ingest('test-wiki', {
    workspace,
    synthesis: true,
    doxLlm: true,
    poolStaggerMs: 0,
    extractChunkFn: async (wikiDir, chunkId) => {
      events.push(`extract:${chunkId}`);
      return makeExtractChunkFnStub({
        'report-2023-part-001': base2023Extraction(),
        'report-2024-part-001': delta2024Extraction(),
        'report-2025-part-001': unrelated2024Extraction(),
      })(wikiDir, chunkId);
    },
    curateTopicsFn: async (candidates) => {
      events.push('curate:topics');
      return keepAllOutcome();
    },
    curateEntitiesFn: async (candidates) => {
      events.push('curate:entities');
      return keepAllOutcome();
    },
    synthesizeEntityFn: async (data) => {
      events.push(`synthesis:${data.slug}`);
      return passingEntityPage(data);
    },
    synthesizeEntityPermissiveFn: async (data) => passingEntityPage(data),
    synthesizeTopicFn: async (data) => {
      events.push(`synthesis:${data.slug}`);
      return passingTopicPage(data);
    },
    synthesizeTopicPermissiveFn: async (data) => passingTopicPage(data),
    amendmentFn: async (request) => {
      events.push(`amendment:${request.pageSlug}`);
      return JSON.stringify({
        operations: [
          {
            op: 'add-evidence',
            section: '## Mentions',
            items: ['- Page 1: "Alpha Corp expanded into Europe" [^src2]'],
          },
          {
            op: 'flag-contradiction',
            section: '## Claims',
            olderClaim: 'Alpha Corp revenue was 100M',
            olderCitation: '[^src1]',
            newerClaim: 'Alpha Corp revenue was 90M',
            newerCitation: '[^src2]',
          },
        ],
      });
    },
    writeDoxIndexFn: async () => {
      events.push('dox:index');
      return 'stub index body';
    },
    writeWorkspaceIndexFn: async () => {
      events.push('dox:workspace-index');
      return 'stub segment';
    },
    writeWorkspaceProseFn: async () => {
      events.push('dox:workspace-prose');
      return 'stub prose';
    },
  });

  const idx = (prefix: string): number => events.findIndex((event) => event.startsWith(prefix));
  const maxIdx = (prefix: string): number => {
    let best = -1;
    events.forEach((event, index) => {
      if (event.startsWith(prefix)) {
        best = index;
      }
    });
    return best;
  };

  // 1. The three PDFs extract in file order — never interleaved.
  expect(idx('extract:report-2023')).toBeGreaterThanOrEqual(0);
  expect(idx('extract:report-2023')).toBeLessThan(idx('extract:report-2024'));
  expect(idx('extract:report-2024')).toBeLessThan(idx('extract:report-2025'));

  // 2. PDF 1's synthesis happens entirely inside its own pass: every PDF-1
  //    synthesis event sits after PDF 1's extraction and before PDF 2's.
  const pdf2ExtractIdx = idx('extract:report-2024');
  const pdf1SynthEvents = events.slice(0, pdf2ExtractIdx).filter((event) => event.startsWith('synthesis:'));
  expect(pdf1SynthEvents).toContain('synthesis:alpha-corp');
  expect(pdf1SynthEvents).toContain('synthesis:jane-doe');
  expect(pdf1SynthEvents).toContain('synthesis:financial');

  // 3. PDF 2's amendment + new-topic synthesis complete before PDF 3 begins.
  expect(idx('amendment:alpha-corp')).toBeGreaterThan(pdf2ExtractIdx);
  expect(idx('extract:report-2025')).toBeGreaterThan(idx('amendment:alpha-corp'));
  expect(idx('extract:report-2025')).toBeGreaterThan(idx('synthesis:operational'));

  // 4. PDF 3's pages synthesize after its extraction.
  expect(idx('synthesis:gamma-inc')).toBeGreaterThan(idx('extract:report-2025'));

  // 5. The curation pair runs exactly once per PDF (three materializes).
  expect(events.filter((event) => event === 'curate:topics')).toHaveLength(3);
  expect(events.filter((event) => event === 'curate:entities')).toHaveLength(3);

  // 6. DOX is deferred: every dox event follows every synthesis/amendment
  //    event (the deterministic DOX chain runs once after the loop).
  expect(idx('dox:index')).toBeGreaterThan(maxIdx('synthesis:'));
  expect(idx('dox:index')).toBeGreaterThan(maxIdx('amendment:'));
  expect(events.filter((event) => event === 'dox:index').length).toBeGreaterThan(0);
  expect(events.filter((event) => event === 'dox:workspace-index')).toHaveLength(1);
});

// ---------------------------------------------------------------------------
// Gate 26.9 (doc): abort after PDF 2 of 3 — the resume hash-skips PDFs 1-2
// and patched pages stay skip-eligible (patch-amended), no re-amendment
// ---------------------------------------------------------------------------

test('gate 26.9 (abort/resume): abort mid-PDF-3; resume skips PDFs 1-2 and the PDF-2 patched page stays skip-eligible', { timeout: 120_000 }, async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(PINNED);

  const workspace = setupWikiWithPdfs(['report-2023.pdf', 'report-2024.pdf', 'report-2025.pdf']);
  const byChunk = {
    'report-2023-part-001': base2023Extraction(),
    'report-2024-part-001': delta2024Extraction(),
    'report-2025-part-001': unrelated2024Extraction(),
  };
  const patchOperations = [
    {
      op: 'add-evidence',
      section: '## Mentions',
      items: ['- Page 1: "Alpha Corp expanded into Europe" [^src2]'],
    },
    {
      op: 'flag-contradiction',
      section: '## Claims',
      olderClaim: 'Alpha Corp revenue was 100M',
      olderCitation: '[^src1]',
      newerClaim: 'Alpha Corp revenue was 90M',
      newerCitation: '[^src2]',
    },
  ];
  const amendmentFn = async () => JSON.stringify({ operations: patchOperations });

  // Run 1: the run dies while extracting PDF 3 — after PDFs 1-2 completed
  // their full passes (per-PDF checkpoints) and alpha-corp was PATCHED.
  await expect(
    ingest('test-wiki', {
      workspace,
      synthesis: true,
      poolStaggerMs: 0,
      ...KEEP_ALL_STUBS,
      extractChunkFn: async (wikiDir, chunkId) => {
        if (chunkId === 'report-2025-part-001') {
          throw new Error('simulated abort during PDF 3 extraction');
        }
        return makeExtractChunkFnStub(byChunk)(wikiDir, chunkId);
      },
      synthesizeEntityFn: async (data) => passingEntityPage(data),
      synthesizeEntityPermissiveFn: async (data) => passingEntityPage(data),
      synthesizeTopicFn: async (data) => passingTopicPage(data),
      synthesizeTopicPermissiveFn: async (data) => passingTopicPage(data),
      amendmentFn,
    }),
  ).rejects.toThrow('simulated abort during PDF 3 extraction');

  // PDFs 1-2 are checkpointed; PDF 3 is not (per-PDF atomicity).
  const checkpoint = JSON.parse(
    readFileSync(wikiPath(workspace, '.state', 'ingestion.json'), 'utf-8'),
  ) as { sources: Record<string, unknown> };
  expect(Object.keys(checkpoint.sources).sort()).toEqual(['report-2023', 'report-2024']);
  const patchedAlpha = readFileSync(wikiPath(workspace, 'entities', 'organizations', 'alpha-corp.md'), 'utf-8');
  expect(patchedAlpha).toContain('Alpha Corp expanded into Europe');
  expect(patchedAlpha).toContain('Alpha Corp revenue was 100M');

  // Run 2 (resume): only PDF 3's chunk re-extracts; PDFs 1-2 hash-skip; the
  // patched page is skip-eligible (patch-amended) so NO amendment re-fires.
  const resumeExtractions: string[] = [];
  const resumeAmendmentCalls: AmendmentRequest[] = [];
  const resumed = await ingest('test-wiki', {
    workspace,
    synthesis: true,
    poolStaggerMs: 0,
    ...KEEP_ALL_STUBS,
    extractChunkFn: async (wikiDir, chunkId) => {
      resumeExtractions.push(chunkId);
      return makeExtractChunkFnStub(byChunk)(wikiDir, chunkId);
    },
    synthesizeEntityFn: async (data) => passingEntityPage(data),
    synthesizeEntityPermissiveFn: async (data) => passingEntityPage(data),
    synthesizeTopicFn: async (data) => passingTopicPage(data),
    synthesizeTopicPermissiveFn: async (data) => passingTopicPage(data),
    amendmentFn: async (request) => {
      resumeAmendmentCalls.push(request);
      return JSON.stringify({ operations: patchOperations });
    },
  });

  expect(resumeExtractions).toEqual(['report-2025-part-001']);
  expect(resumed.skipped.sort()).toEqual(['report-2023', 'report-2024']);
  expect(resumeAmendmentCalls).toHaveLength(0);
  expect(resumed.patchedPages).toBe(0);
  expect(resumed.synthesized).toBe(1); // gamma-inc, the only new page
  const finalAlpha = readFileSync(wikiPath(workspace, 'entities', 'organizations', 'alpha-corp.md'), 'utf-8');
  expect(finalAlpha).toBe(patchedAlpha);
  expect(existsSync(wikiPath(workspace, 'entities', 'organizations', 'gamma-inc.md'))).toBe(true);
});

// ---------------------------------------------------------------------------
// Gate 26.11 (live): the REAL Amendment Writer against glm-5.3-flash — a
// schema-valid patch whose applied merge passes the merged-page preservation
// check end-to-end. Self-skips without ZAI_API_KEY (the key-less profile).
// ---------------------------------------------------------------------------

/** Mirrors the client's own .env fallback so skipIf reflects the key in use. */
function loadDotEnvZaiKey(): void {
  if (process.env.ZAI_API_KEY) {
    return;
  }
  try {
    const envPath = join(process.cwd(), '.env');
    if (!existsSync(envPath)) {
      return;
    }
    for (const line of readFileSync(envPath, 'utf-8').split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) {
        continue;
      }
      const eq = trimmed.indexOf('=');
      if (eq === -1) {
        continue;
      }
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"') && value.length >= 2) ||
        (value.startsWith("'") && value.endsWith("'") && value.length >= 2)
      ) {
        value = value.slice(1, -1);
      }
      if (key === 'ZAI_API_KEY' && !(key in process.env)) {
        process.env[key] = value;
      }
    }
  } catch {
    // No .env — the gate self-skips.
  }
}
loadDotEnvZaiKey();

test.skipIf(!process.env.ZAI_API_KEY)(
  'gate 26.11 (live): the real writeAmendment against glm-5.3-flash returns a schema-valid patch whose merge passes merged-page preservation, logged zhipu/glm-5.3-flash/synthesis-amend',
  async () => {
    // Pin the SYNTHESIS slot (the synthesis-amend routing) to
    // zhipu/glm-5.3-flash — the §3 pinning rule makes any other model
    // unreachable from this test.
    setModelRouting({
      provider: 'anthropic',
      default: 'claude-haiku-4.5',
      extractor: null,
      synthesis: { provider: 'zhipu', model: 'glm-5.3-flash' },
      dox: null,
      crossWiki: null,
      crossWikiJudgment: null,
      curation: null,
    });
    const workspace = makeTempDir('paper-chase-g26-live-');
    const logPath = wikiPath(workspace, '.state', 'llm-calls.json');
    mkdirSync(dirname(logPath), { recursive: true });
    try {
      // The OLD aggregate (what PDF 1 synthesized) and the CURRENT aggregate
      // (PDF 2 added one mention + one claim) — the delta is exactly the two
      // new items.
      const oldMention = {
        page: 1,
        context: 'Alpha Corp led the consortium bid',
        source: 'wikis/live-wiki/raw/report-2023.pdf',
        pages: '1-3',
      };
      const oldClaim = {
        text: 'Alpha Corp revenue was 100M',
        type: 'financial',
        entities: ['alpha-corp'],
        page: 3,
        source: 'wikis/live-wiki/raw/report-2023.pdf',
        pages: '1-3',
      };
      const newMention = {
        page: 1,
        context: 'Alpha Corp expanded into Europe',
        source: 'wikis/live-wiki/raw/report-2024.pdf',
        pages: '1-2',
      };
      const newClaim = {
        text: 'Alpha Corp revenue was 90M',
        type: 'operational',
        entities: ['alpha-corp'],
        page: 2,
        source: 'wikis/live-wiki/raw/report-2024.pdf',
        pages: '1-2',
      };
      const oldData: EntityPageData = {
        title: 'Alpha Corp',
        slug: 'alpha-corp',
        folder: 'entities/organizations',
        type: 'organization',
        wiki: 'live-wiki',
        mentions: [oldMention],
        relationships: [],
        claims: [oldClaim],
        slugToTitle: {},
      };
      const livePageData: EntityPageData = {
        ...oldData,
        mentions: [oldMention, newMention],
        claims: [oldClaim, newClaim],
      };
      const baselineKeys = evidenceKeysFor(oldData);
      const delta = newEvidenceFor(livePageData, baselineKeys);
      expect(delta.empty).toBe(false);

      // The existing synthesized page (PDF 1's output) — the patch target.
      const pageContent = [
        '---',
        'title: Alpha Corp',
        'type: entity',
        'wiki: live-wiki',
        "updated: '2026-08-27T00:00:00.000Z'",
        'sources:',
        '  - file: wikis/live-wiki/raw/report-2023.pdf',
        '    pages: 1-3',
        '---',
        'Synthesis prose for Alpha Corp.',
        '',
        '## Mentions',
        '',
        '- Page 1: "Alpha Corp led the consortium bid" [^src1]',
        '',
        '## Claims',
        '',
        '- Alpha Corp revenue was 100M [^src1]',
        '',
        '## Sources',
        '',
        '[^src1]: report-2023.pdf, pages 1-3',
        '',
      ].join('\n');

      const request = buildAmendmentRequest({ pageData: livePageData, delta, pageContent });
      expect(request.newEvidence).toContain('Alpha Corp expanded into Europe');
      expect(request.newEvidence).toContain('Alpha Corp revenue was 90M');

      // The production episode's validate → apply → merged-preservation loop
      // (≤3 attempts, validator feedback fed back) — a patch that needs one
      // reask still passes the gate; exhaustion fails it.
      let feedback: string | undefined;
      let merged: string | null = null;
      let attempts = 0;
      while (attempts < 3 && merged === null) {
        attempts += 1;
        const raw = await writeAmendment(
          request,
          '(No AGENTS.md provided.)',
          logPath,
          { input: 'en', output: 'en' },
          feedback,
          attempts,
        );
        const parsed = parsePatch(raw);
        let errors: string[] = [];
        if (parsed.patch === undefined) {
          errors = parsed.errors;
        } else {
          const validation = validatePatch(parsed.patch, { pageContent, pageKind: 'entity' });
          if (!validation.valid) {
            errors = validation.errors;
          } else {
            try {
              const applied = applyPatch(pageContent, parsed.patch);
              const check = checkPreservation(livePageData, applied);
              if (check.passed) {
                merged = applied;
              } else {
                const dropped = [
                  ...(check.droppedMentions ?? []).map((item) => `Dropped mention (restore this exact text): ${item}`),
                  ...(check.droppedClaims ?? []).map((item) => `Dropped claim (restore this exact text): ${item}`),
                ];
                errors = dropped.length > 0 ? dropped : ['The merged-page preservation check failed; restore all dropped content verbatim.'];
              }
            } catch (err) {
              errors = [(err as Error).message];
            }
          }
        }
        if (merged === null) {
          feedback = buildCorrectionBlock(raw, errors);
        }
      }

      expect(merged, 'the real Amendment Writer must produce a preservation-passing patch within 3 attempts').not.toBeNull();
      expect(merged).toContain('Alpha Corp led the consortium bid');
      expect(merged).toContain('Alpha Corp expanded into Europe');
      expect(merged).toContain('Alpha Corp revenue was 100M');
      expect(merged).toContain('Alpha Corp revenue was 90M');

      // The call is logged with the pinned provider/model/callType.
      const entries = readFileSync(logPath, 'utf-8')
        .trim()
        .split('\n')
        .map((line) => JSON.parse(line) as Record<string, unknown>);
      const amendEntries = entries.filter(
        (entry) =>
          entry.provider === 'zhipu' && entry.model === 'glm-5.3-flash' && entry.callType === 'synthesis-amend',
      );
      expect(amendEntries.length).toBeGreaterThan(0);
      const totalIn = amendEntries.reduce((sum, entry) => sum + (Number(entry.inputTokens) || 0), 0);
      const totalOut = amendEntries.reduce((sum, entry) => sum + (Number(entry.outputTokens) || 0), 0);
      const cost = (totalIn / 1_000_000) * 0.15 + (totalOut / 1_000_000) * 0.5;
      console.log(
        `LIVE-26.11: ${amendEntries.length} amendment call(s), ${totalIn} in / ${totalOut} out tokens, est. $${cost.toFixed(6)} at glm-5.3-flash pricing.`,
      );
    } finally {
      setModelRouting(null);
    }
  },
  480_000,
);

// ---------------------------------------------------------------------------
// Golden fixture (self-contained: the temporary capture harness that froze
// the golden was deleted after the capture — this copy is the source of
// truth for gate 26.2's replay)
// ---------------------------------------------------------------------------

function goldenFixtureExtraction(): ExtractorResult {
  return {
    entities: [
      {
        name: 'Alpha Corp',
        type: 'organization',
        slug: 'alpha-corp',
        folder: 'entities/organizations',
        significance: 'The fixture survivor.',
        mentions: [
          { page: 1, context: 'Alpha Corp led the consortium bid' },
          { page: 2, context: 'The Alpha Corp board met twice' },
        ],
      },
      {
        name: 'Jane Doe',
        type: 'person',
        slug: 'jane-doe',
        folder: 'entities/people',
        significance: 'Alpha Corp CEO.',
        mentions: [{ page: 2, context: 'Jane Doe chairs the Alpha Corp board' }],
      },
    ],
    relationships: [
      {
        subject: 'jane-doe',
        predicate: 'is-ceo-of',
        object: 'alpha-corp',
        evidence: 'Jane Doe chairs the Alpha Corp board',
        page: 2,
      },
    ],
    claims: [
      {
        text: 'Alpha Corp won the regional tender',
        type: 'financial',
        entities: ['alpha-corp'],
        page: 3,
      },
    ],
    timeline: [{ date: '2024-03-01', event: 'Tender decision announced', entities: ['alpha-corp'] }],
    context: 'Phase 26 golden fixture extraction.',
  };
}
