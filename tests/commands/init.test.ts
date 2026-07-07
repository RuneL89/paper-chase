import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, existsSync, readFileSync, rmSync } from 'fs';
import path from 'path';
import { tmpdir } from 'os';
import matter from 'gray-matter';
import { initCommand } from '../../src/commands/init.js';
import { CLIError } from '../../src/errors.js';

describe('init command', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(path.join(tmpdir(), 'llm-wiki-cli-init-'));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('TAC-001: creates the expected wiki folder tree', async () => {
    await initCommand({
      workspace: tmpDir,
      slug: 'donations',
      title: 'Political Donations',
      description: 'Annual filings and donation records.',
    });

    const wikiDir = path.join(tmpDir, 'wikis', 'donations');
    expect(existsSync(wikiDir)).toBe(true);
    expect(existsSync(path.join(wikiDir, 'raw'))).toBe(true);
    expect(existsSync(path.join(wikiDir, 'config.json'))).toBe(true);
    expect(existsSync(path.join(wikiDir, 'index.md'))).toBe(true);
    expect(existsSync(path.join(wikiDir, 'AGENTS.md'))).toBe(true);
    expect(existsSync(path.join(wikiDir, 'chunking-strategy.md'))).toBe(true);
  });

  it('TAC-002: writes config.json with status initialized', async () => {
    await initCommand({
      workspace: tmpDir,
      slug: 'donations',
      title: 'Political Donations',
      description: 'Annual filings and donation records.',
    });

    const configPath = path.join(tmpDir, 'wikis', 'donations', 'config.json');
    const config = JSON.parse(readFileSync(configPath, 'utf-8')) as { status: string; wiki: { title: string; description: string } };
    expect(config.status).toBe('initialized');
    expect(config.wiki.title).toBe('Political Donations');
    expect(config.wiki.description).toBe('Annual filings and donation records.');
  });

  it('TAC-003: rejects an invalid slug', async () => {
    await expect(
      initCommand({
        workspace: tmpDir,
        slug: 'Invalid Slug',
        title: 'Invalid',
        description: 'Invalid.',
      }),
    ).rejects.toBeInstanceOf(CLIError);
  });

  it('TAC-004: fails if the wiki already exists without --force', async () => {
    await initCommand({
      workspace: tmpDir,
      slug: 'donations',
      title: 'Political Donations',
      description: 'Annual filings and donation records.',
    });

    await expect(
      initCommand({
        workspace: tmpDir,
        slug: 'donations',
        title: 'Political Donations',
        description: 'Annual filings and donation records.',
      }),
    ).rejects.toBeInstanceOf(CLIError);
  });

  it('TAC-005: re-initializes with --force', async () => {
    await initCommand({
      workspace: tmpDir,
      slug: 'donations',
      title: 'Political Donations',
      description: 'Annual filings and donation records.',
    });

    await initCommand({
      workspace: tmpDir,
      slug: 'donations',
      title: 'Updated Donations',
      description: 'Updated description.',
      force: true,
    });

    const configPath = path.join(tmpDir, 'wikis', 'donations', 'config.json');
    const config = JSON.parse(readFileSync(configPath, 'utf-8')) as { wiki: { title: string } };
    expect(config.wiki.title).toBe('Updated Donations');
  });

  it('TAC-006: skeleton AGENTS.md has valid frontmatter and required sections', async () => {
    await initCommand({
      workspace: tmpDir,
      slug: 'donations',
      title: 'Political Donations',
      description: 'Annual filings and donation records.',
    });

    const agentsPath = path.join(tmpDir, 'wikis', 'donations', 'AGENTS.md');
    const content = readFileSync(agentsPath, 'utf-8');
    const parsed = matter(content);
    expect(parsed.data.type).toBe('agents-guide');
    expect(parsed.data.wiki).toBe('donations');
    expect(parsed.data.title).toContain('AGENTS.md');
    expect(content).toContain('## Purpose and Scope');
    expect(content).toContain('## Folder Structure');
    expect(content).toContain('## Page Types');
    expect(content).toContain('## Citation Rules');
    expect(content).toContain('## Content Rules');
    expect(content).toContain('## Workflows');
    expect(content).toContain('## Lint / Quality Rules');
    expect(content).toContain('## Authority Matrix');
  });

  it('TAC-007: skeleton index.md has valid frontmatter', async () => {
    await initCommand({
      workspace: tmpDir,
      slug: 'donations',
      title: 'Political Donations',
      description: 'Annual filings and donation records.',
    });

    const indexPath = path.join(tmpDir, 'wikis', 'donations', 'index.md');
    const content = readFileSync(indexPath, 'utf-8');
    const parsed = matter(content);
    expect(parsed.data.type).toBe('index');
    expect(parsed.data.wiki).toBe('donations');
    expect(parsed.data.title).toBe('Political Donations');
  });
});
