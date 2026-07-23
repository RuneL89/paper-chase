import { copyFileSync, existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { init } from '../src/commands/init';
import { ingest } from '../src/commands/ingest';
import { validateWiki } from '../src/validation';

// Phase 11 (phase doc §2.7): one true end-to-end test — real PDFs, real LLM
// calls, real cost. It is slow and expensive, so it only runs when explicitly
// enabled (RUN_E2E=1 npm test), e.g. before a release — never in CI and never
// as part of the default `npm test` run (the default suite is LLM-free).

const RUN_E2E = process.env.RUN_E2E === '1';

test.skipIf(!RUN_E2E)(
  'end-to-end: init, add PDFs, ingest, verify pages, links, citations, metrics',
  async () => {
    const workspace = mkdtempSync(join(tmpdir(), 'paper-chase-e2e-'));
    try {
      // 1. init a wiki.
      await init('e2e-wiki', { workspace, title: 'E2E Wiki' });

      // 2. Copy PDFs to raw/.
      const raw = join(workspace, 'wikis', 'e2e-wiki', 'raw');
      copyFileSync('test-pdfs/golden-master.pdf', join(raw, 'golden-master.pdf'));
      copyFileSync('test-pdfs/golden-master-2.pdf', join(raw, 'golden-master-2.pdf'));

      // 3. Run the full pipeline (extraction + synthesis + DOX writer).
      const result = await ingest('e2e-wiki', {
        workspace,
        synthesis: true,
        doxLlm: true,
        onProgress: () => {},
      });
      expect(result.ingested.length).toBe(2);

      // 4. Expected pages exist: document pages per PDF, entity pages, topic
      // pages, source pages, and the DOX contracts.
      const wikiDir = join(workspace, 'wikis', 'e2e-wiki');
      for (const source of result.ingested) {
        for (const page of source.documentPages) {
          expect(existsSync(join(wikiDir, page))).toBe(true);
        }
      }
      expect(existsSync(join(wikiDir, 'entities'))).toBe(true);
      expect(existsSync(join(wikiDir, 'sources'))).toBe(true);
      expect(existsSync(join(wikiDir, 'AGENTS.md'))).toBe(true);
      expect(existsSync(join(wikiDir, 'index.md'))).toBe(true);

      // 5-6. All links resolve and all citations are valid (deterministic
      // validation pass over the finished wiki).
      const validation = await validateWiki('e2e-wiki', workspace);
      expect(validation.links.broken).toEqual([]);
      expect(validation.citations.invalid).toEqual([]);
      expect(validation.citations.missingSource).toEqual([]);
      expect(validation.schema.invalid).toEqual([]);

      // 7. Metrics are reasonable: chunks were processed, LLM tokens cost
      // money, and the run took measurable wall-clock time.
      const metrics = JSON.parse(readFileSync(join(wikiDir, '.state', 'metrics.json'), 'utf-8')) as {
        chunksProcessed: number;
        totalCost: number;
        totalTokens: { input: number; output: number };
        wallClockMs: number;
      };
      expect(metrics.chunksProcessed).toBeGreaterThan(0);
      expect(metrics.totalCost).toBeGreaterThan(0);
      expect(metrics.totalTokens.input).toBeGreaterThan(0);
      expect(metrics.wallClockMs).toBeGreaterThan(0);
    } finally {
      rmSync(workspace, { recursive: true, force: true });
    }
  },
  600000,
);
