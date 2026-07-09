import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import path from 'path';
import { tmpdir } from 'os';
import matter from 'gray-matter';
import { applyProposalCommand } from '../../src/commands/apply-proposal.js';
import { initCommand } from '../../src/commands/init.js';
import { writeProposalFile } from '../../src/orchestrator/proposals.js';

// Re-use helper from proposals.test.ts to avoid duplication.
export function makeFolderPlan(folder: string, title: string, pageTypes: string[] = ['document']) {
  return { folder, title, description: `Folder ${folder}`, pageTypes, children: [] as string[] };
}

describe('apply-proposal command', () => {
  let workspace: string;

  beforeEach(async () => {
    workspace = mkdtempSync(path.join(tmpdir(), 'apply-proposal-'));
    await initCommand({ workspace, slug: 'acme', title: 'Acme', description: 'Test.' });
  });

  afterEach(() => {
    // Temp directory cleanup is handled by the OS.
  });

  it('applies an approved proposal and creates the new folder', async () => {
    const proposal = {
      type: 'new-folder' as const,
      reason: 'Need a timeline folder.',
      currentFolders: ['documents'],
      proposedFolders: ['documents', 'timeline'],
      newFolderPlans: [makeFolderPlan('timeline', 'Timeline', ['timeline'])],
    };
    const filePath = writeProposalFile(workspace, 'acme', proposal);
    const parsed = matter(readFileSync(filePath, 'utf-8'));
    parsed.data.status = 'approved';
    writeFileSync(filePath, matter.stringify(parsed.content, parsed.data));

    const code = await applyProposalCommand(workspace, 'acme', path.basename(filePath));
    expect(code).toBe(0);
    expect(existsSync(path.join(workspace, 'wikis', 'acme', 'timeline', 'index.md'))).toBe(true);
  });

  it('rejects a proposal with rejected status', async () => {
    const proposal = {
      type: 'new-folder' as const,
      reason: 'Need a timeline folder.',
      currentFolders: ['documents'],
      proposedFolders: ['documents', 'timeline'],
      newFolderPlans: [makeFolderPlan('timeline', 'Timeline')],
    };
    const filePath = writeProposalFile(workspace, 'acme', proposal);
    const parsed = matter(readFileSync(filePath, 'utf-8'));
    parsed.data.status = 'rejected';
    writeFileSync(filePath, matter.stringify(parsed.content, parsed.data));

    await applyProposalCommand(workspace, 'acme', path.basename(filePath));
    expect(existsSync(filePath)).toBe(false);
    expect(existsSync(filePath.replace('-structural-change.md', '-structural-change-rejected.md'))).toBe(true);
  });

  it('throws when the proposal status is pending', async () => {
    const proposal = {
      type: 'new-folder' as const,
      reason: 'Need a timeline folder.',
      currentFolders: ['documents'],
      proposedFolders: ['documents', 'timeline'],
      newFolderPlans: [makeFolderPlan('timeline', 'Timeline')],
    };
    const filePath = writeProposalFile(workspace, 'acme', proposal);
    await expect(applyProposalCommand(workspace, 'acme', path.basename(filePath))).rejects.toThrow();
  });
});
