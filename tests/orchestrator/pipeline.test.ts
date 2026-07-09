import { describe, it, expect } from 'vitest';
import { updateMemory, createInitialMemory } from '../../src/orchestrator/agents.js';
import { compactMemoryIfNeeded, DEFAULT_MEMORY_CAPS } from '../../src/orchestrator/memory.js';
import type { ExtractedEntity, ExtractedRelationship, FolderPlan } from '../../src/orchestrator/types.js';
import type { ExtractionResult } from '../../src/extractor/types.js';
import type { Chunk } from '../../src/chunking/types.js';

function makeMemory(): ReturnType<typeof createInitialMemory> {
  const result: ExtractionResult = {
    fileName: 'annual-report.pdf',
    filePath: 'wikis/acme/raw/annual-report.pdf',
    physicalPages: 1,
    logicalPages: 1,
    metadata: { title: 'Annual Report' },
    pages: [
      { physicalPage: 1, logicalPage: 1, text: 'Acme Corp reported revenue.', isScanned: false, estimatedHeadings: [] },
    ],
    tables: [],
    figures: [],
    warnings: [],
    ingested: '2026-07-08T00:00:00.000Z',
  };
  const chunks: Chunk[] = [
    { id: 'part-001', title: 'Part 1', pageRange: '1', boundaryType: 'page', content: 'Acme Corp reported revenue.', sources: [], tags: ['document'], belowMin: false, charCount: 28 },
  ];
  return createInitialMemory(result, chunks);
}

function entity(name: string, canonical: string, count = 1, aliases: string[] = []): ExtractedEntity {
  return {
    name,
    canonical,
    aliases,
    type: 'organization',
    count,
    mentions: [{ page: 1, context: 'mentioned' }],
    confidence: 0.9,
  };
}

function relationship(subject: string, object: string): ExtractedRelationship {
  return { subject, predicate: 'related to', object, evidence: 'mentioned together', pages: '1' };
}

function folderPlans(): FolderPlan[] {
  return [
    { folder: 'documents', title: 'Documents', description: '', pageTypes: ['document'], children: [] },
    { folder: 'entities', title: 'Entities', description: '', pageTypes: ['entity'], children: [] },
  ];
}

describe('canonical name resolution and memory updates', () => {
  it('TAC-001: merges entities by canonical slug and accumulates counts', () => {
    const memory = makeMemory();
    const entities = [
      entity('Acme Corp', 'acme-corp', 2, []),
      entity('Acme Corp', 'acme-corp', 1, []),
    ];
    updateMemory(memory, 'source-a', entities, [], [], folderPlans());

    expect(Object.keys(memory.state.entities)).toHaveLength(1);
    const acme = memory.state.entities['acme-corp'];
    expect(acme).toBeDefined();
    expect(acme.name).toBe('Acme Corp');
    expect(acme.count).toBe(3);
  });

  it('TAC-002: accumulates counts across multiple source updates for the same canonical entity', () => {
    const memory = makeMemory();
    updateMemory(memory, 'source-a', [entity('Acme Corp', 'acme-corp', 2)], [], [], folderPlans());
    updateMemory(memory, 'source-b', [entity('Acme Corp', 'acme-corp', 3)], [], [], folderPlans());

    expect(memory.state.entities['acme-corp'].count).toBe(5);
    expect(memory.state.sourceEntities['source-a']['acme-corp']).toBe(2);
    expect(memory.state.sourceEntities['source-b']['acme-corp']).toBe(3);
  });

  it('TAC-003: subtracts old source contributions before re-ingestion', () => {
    const memory = makeMemory();
    updateMemory(memory, 'source-a', [entity('Acme Corp', 'acme-corp', 5)], [], [], folderPlans());
    updateMemory(memory, 'source-a', [entity('Acme Corp', 'acme-corp', 2)], [], [], folderPlans());

    expect(memory.state.entities['acme-corp'].count).toBe(2);
    expect(memory.state.sourceEntities['source-a']['acme-corp']).toBe(2);
  });

  it('TAC-004: stores relationships and topics in memory', () => {
    const memory = makeMemory();
    const rels: ExtractedRelationship[] = [relationship('Acme Corp', 'Globex Inc')];
    const topics = [{ name: 'earnings growth', count: 2, related: ['entities/acme-corp.md'] }];
    updateMemory(memory, 'source-a', [entity('Acme Corp', 'acme-corp', 1)], rels, topics, folderPlans());

    expect(memory.state.relationships).toHaveLength(1);
    expect(memory.state.topics['earnings growth']).toBeDefined();
    expect(memory.state.topics['earnings growth'].related).toContain('entities/acme-corp.md');
  });
});

describe('duplicate entity flagging', () => {
  it('TAC-005: flags potential duplicate entities with similar slugs', () => {
    const memory = makeMemory();
    updateMemory(
      memory,
      'source-a',
      [
        entity('Acme Corp', 'acme-corp', 1),
        entity('Acme Corpp', 'acme-corpp', 1),
      ],
      [],
      [],
      folderPlans(),
    );

    expect(memory.state.duplicateFlags.length).toBeGreaterThan(0);
    const flag = memory.state.duplicateFlags[0];
    expect([flag.a, flag.b]).toContain('acme-corp');
    expect([flag.a, flag.b]).toContain('acme-corpp');
  });
});

describe('memory compaction', () => {
  it('TAC-006: archives oldest entities when entity cap is exceeded', () => {
    const memory = makeMemory();
    for (let i = 0; i < 10; i++) {
      updateMemory(
        memory,
        `source-${i}`,
        [entity(`Entity ${i}`, `entity-${i}`, i + 1)],
        [],
        [],
        folderPlans(),
      );
    }

    const caps = { ...DEFAULT_MEMORY_CAPS, maxEntities: 5 };
    const result = compactMemoryIfNeeded(memory, caps);

    expect(result.compacted).toBe(true);
    expect(result.archivedEntities.length).toBeGreaterThan(0);
    expect(result.summaryOnly).toBe(true);
    expect(memory.historicalSummary).toContain('Archived entities');
  });
});
