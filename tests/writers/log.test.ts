import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, existsSync } from 'fs';
import path from 'path';
import os from 'os';
import matter from 'gray-matter';
import { appendLogEntry, readLogEntries } from '../../src/writers/log.js';

describe('append-only log.md', () => {
  let wikiDir: string;
  let outputDirName: string;

  beforeAll(() => {
    const workspace = mkdtempSync(path.join(os.tmpdir(), 'wiki-log-writer-'));
    wikiDir = path.join(workspace, 'wikis', 'acme');
    outputDirName = '.';
  });

  afterAll(() => {
    rmSync(path.dirname(path.dirname(wikiDir)), { recursive: true, force: true });
  });

  it('TAC-001: creates a log file with the first entry', () => {
    appendLogEntry(wikiDir, outputDirName, {
      timestamp: '2026-07-09T10:00:00Z',
      command: 'ingest',
      sources: [{ filePath: 'raw/a.pdf', sha256: 'a'.repeat(64), status: 'added' }],
      pages: [{ filePath: 'documents/doc-a.md', action: 'created' }],
      errors: [],
      warnings: [],
    });

    const filePath = path.join(wikiDir, outputDirName, 'log.md');
    expect(existsSync(filePath)).toBe(true);
    const content = readFileSync(filePath, 'utf-8');
    expect(content).toContain('# Ingestion Log');
    expect(content).toContain('2026-07-09T10:00:00Z');
    expect(content).toContain('ingest');
  });

  it('TAC-002: appends new entries without removing old ones', () => {
    appendLogEntry(wikiDir, outputDirName, {
      timestamp: '2026-07-09T11:00:00Z',
      command: 'ingest',
      sources: [{ filePath: 'raw/b.pdf', sha256: 'b'.repeat(64), status: 'changed' }],
      pages: [{ filePath: 'documents/doc-b.md', action: 'updated' }],
      errors: ['Extraction warning'],
      warnings: ['Low confidence'],
      structuralChanges: ['new-folder: timeline (applied)'],
    });

    const entries = readLogEntries(wikiDir, outputDirName);
    expect(entries.length).toBe(2);

    const content = readFileSync(path.join(wikiDir, outputDirName, 'log.md'), 'utf-8');
    expect(content).toContain('raw/a.pdf');
    expect(content).toContain('raw/b.pdf');
    expect(content).toContain('Extraction warning');
    expect(content).toContain('timeline');
  });
});
