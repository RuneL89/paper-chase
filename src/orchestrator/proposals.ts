import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { CLIError } from '../errors.js';
import type { Config } from '../config.js';
import type { FolderPlan, PagePlan, StructuralProposal } from './types.js';
import { writeFolderIndexContract, type WikiIndexData } from './contracts.js';

export function detectStructuralProposals(
  previousHierarchy: Record<string, FolderPlan>,
  currentPlacements: FolderPlan[],
): StructuralProposal[] {
  const previousFolders = new Set(Object.keys(previousHierarchy));
  const currentFolders = new Set(currentPlacements.map((f) => f.folder));
  const addedFolders = currentPlacements.filter((f) => !previousFolders.has(f.folder));
  const removedFolders = Array.from(previousFolders).filter((f) => !currentFolders.has(f));

  const renamedFolders: { from: string; to: string; title: string; description: string; pageTypes: string[]; children: string[] }[] = [];
  const previousByTitle = new Map<string, string>();
  for (const [slug, plan] of Object.entries(previousHierarchy)) {
    previousByTitle.set(plan.title, slug);
  }
  for (const current of addedFolders) {
    const previousSlug = previousByTitle.get(current.title);
    if (previousSlug && !currentFolders.has(previousSlug)) {
      renamedFolders.push({
        from: previousSlug,
        to: current.folder,
        title: current.title,
        description: current.description,
        pageTypes: current.pageTypes,
        children: current.children,
      });
    }
  }

  const effectiveAdded = addedFolders.filter(
    (f) => !renamedFolders.some((r) => r.to === f.folder),
  );
  const effectiveRemoved = removedFolders.filter(
    (f) => !renamedFolders.some((r) => r.from === f),
  );

  if (previousFolders.size === 0 || (effectiveAdded.length === 0 && effectiveRemoved.length === 0 && renamedFolders.length === 0)) {
    return [];
  }

  const type: 'new-folder' | 'restructure' =
    effectiveAdded.length === 1 && effectiveRemoved.length === 0 && renamedFolders.length === 0
      ? 'new-folder'
      : 'restructure';

  return [
    {
      type,
      reason: buildProposalReason(effectiveAdded, effectiveRemoved, renamedFolders),
      currentFolders: Array.from(previousFolders),
      proposedFolders: Array.from(currentFolders),
      newFolderPlans: effectiveAdded,
      renamedFolders: renamedFolders.length > 0 ? renamedFolders : undefined,
    },
  ];
}

function buildProposalReason(
  added: FolderPlan[],
  removed: string[],
  renamed: { from: string; to: string; title: string }[] = [],
): string {
  const parts: string[] = [];
  if (added.length > 0) {
    parts.push(`new folder(s): ${added.map((f) => f.title).join(', ')}`);
  }
  if (removed.length > 0) {
    parts.push(`removed folder(s): ${removed.join(', ')}`);
  }
  if (renamed.length > 0) {
    parts.push(`renamed folder(s): ${renamed.map((r) => `${r.title} (${r.from}/ → ${r.to}/)`).join(', ')}`);
  }
  return `Corpus structure changed and requires ${parts.join('; ')}.`;
}

export function isSimpleProposal(proposal: StructuralProposal): boolean {
  return proposal.type === 'new-folder' && proposal.newFolderPlans.length === 1;
}

export function proposalFileName(workspace: string, slug: string, timestamp = new Date()): string {
  const proposalsDir = path.join(workspace, '.kimi-code', 'proposals');
  mkdirSync(proposalsDir, { recursive: true });
  const iso = timestamp.toISOString().replace(/[:.]/g, '-');
  return path.join(proposalsDir, `${iso}-${slug}-structural-change.md`);
}

export function writeProposalFile(
  workspace: string,
  slug: string,
  proposal: StructuralProposal,
): string {
  const filePath = proposalFileName(workspace, slug);
  const lines = renderProposalMarkdown(slug, proposal, filePath);
  writeFileSync(filePath, matter.stringify(lines.join('\n'), {
    title: `Structural Change Log — ${slug}`,
    type: 'proposal',
    wiki: slug,
    status: 'applied',
    created: new Date().toISOString(),
  }));
  return filePath;
}

export function renderProposalMarkdown(slug: string, proposal: StructuralProposal, filePath: string): string[] {
  const lines: string[] = [
    `# Structural Change Log — ${slug}`,
    '',
    '## Reason',
    '',
    proposal.reason,
    '',
    '## Current folders',
    '',
    ...proposal.currentFolders.map((f) => `- \`${f}/\``),
    '',
    '## Proposed folders',
    '',
    ...proposal.proposedFolders.map((f) => `- \`${f}/\``),
    '',
    '## New folder details',
    '',
    ...proposal.newFolderPlans.map((f) => `- **${f.folder}/** — ${f.title}: ${f.description}`),
    '',
    ...(proposal.renamedFolders && proposal.renamedFolders.length > 0
      ? [
          '## Renamed folders',
          '',
          ...proposal.renamedFolders.map(
            (r) => `- **${r.from}/** → **${r.to}/** — ${r.title}: ${r.description}`,
          ),
          '',
        ]
      : []),
    ...(proposal.movedFolders && proposal.movedFolders.length > 0
      ? [
          '## Moved folders',
          '',
          ...proposal.movedFolders.map(
            (m) => `- **${m.from}/** → **${m.to}/** — ${m.title}: ${m.description}`,
          ),
          '',
        ]
      : []),
    '## Pros',
    '',
    '- Better reflects the corpus structure discovered during ingestion.',
    '- Provides a dedicated location for pages that do not fit the default folders.',
    '',
    '## Cons',
    '',
    '- Adds complexity to the wiki hierarchy.',
    '- Requires updates to the wiki-level and folder-level index contracts.',
    '',
    '## Required contract updates',
    '',
    '- Update `wikis/' + slug + '/index.md` to list the new folder(s).',
    '- Create folder-level `index.md` contract(s) for the new folder(s).',
    '- Update `wikis/' + slug + '/AGENTS.md` to document the new folder(s).',
    ...(proposal.renamedFolders && proposal.renamedFolders.length > 0
      ? ['- Rename the affected folder directories and update existing page paths.', '']
      : []),
    ...(proposal.movedFolders && proposal.movedFolders.length > 0
      ? ['- Move the affected folder directories and update existing page paths.', '']
      : []),
  ];
  return lines;
}

export function applyProposal(
  workspace: string,
  slug: string,
  proposalPath: string,
  config: Config,
  state: import('../ingestion/state.js').IngestionState,
  memory: import('./types.js').OrchestratorMemory,
): { proposal: StructuralProposal; approved: boolean } {
  if (!existsSync(proposalPath)) {
    throw new CLIError(`Proposal file not found: ${proposalPath}`);
  }

  const content = readFileSync(proposalPath, 'utf-8');
  const proposal = parseProposalMarkdown(content);
  if (!proposal) {
    throw new CLIError('Invalid proposal file content');
  }

  applyFolderRenames(workspace, slug, proposal, state, memory);
  applyNewFolderPlans(workspace, slug, proposal.newFolderPlans, config, memory);

  // Update rolling memory to reflect the new hierarchy.
  for (const folder of proposal.newFolderPlans) {
    memory.state.folderHierarchy[folder.folder] = folder;
  }

  // Mark proposal as applied.
  const appliedPath = proposalPath.replace(/-structural-change\.md$/, '-structural-change-applied.md');
  renameSync(proposalPath, appliedPath);

  return { proposal, approved: true };
}

function applyNewFolderPlans(
  workspace: string,
  slug: string,
  newFolderPlans: FolderPlan[],
  config: Config,
  memory: import('./types.js').OrchestratorMemory,
): void {
  const wikiDir = path.join(workspace, 'wikis', slug);
  const indexData: WikiIndexData = {
    slug,
    title: config.wiki.title,
    description: config.wiki.description,
    scope: memory.rollingSummary,
    sourceCount: 0,
    documentCount: 0,
    entityCount: 0,
    topicCount: 0,
    rawCount: 0,
    folders: newFolderPlans,
    warnings: [],
  };
  for (const folder of newFolderPlans) {
    const folderIndexPath = path.join(wikiDir, folder.folder, 'index.md');
    mkdirSync(path.dirname(folderIndexPath), { recursive: true });
    writeFolderIndexContract(folderIndexPath, folder, indexData, memory);
  }
}

export function applyStructuralChanges(
  workspace: string,
  slug: string,
  proposal: StructuralProposal,
  config: Config,
  memory: import('./types.js').OrchestratorMemory,
  state?: import('../ingestion/state.js').IngestionState,
): StructuralProposal {
  // Write the structural change log for after-the-fact human review.
  const filePath = writeProposalFile(workspace, slug, proposal);
  const wikiDir = path.join(workspace, 'wikis', slug);

  // Apply folder renames/moves before updating the hierarchy so state paths stay consistent.
  if (state) {
    applyFolderRenames(workspace, slug, proposal, state, memory);
  }

  applyNewFolderPlans(workspace, slug, proposal.newFolderPlans, config, memory);

  // Mark the log file as applied.
  const appliedPath = filePath.replace(/-structural-change\.md$/, '-structural-change-applied.md');
  renameSync(filePath, appliedPath);

  // Update rolling memory to reflect the new hierarchy.
  for (const folder of proposal.newFolderPlans) {
    memory.state.folderHierarchy[folder.folder] = folder;
  }

  return { ...proposal, applied: true };
}

export function applyFolderRenames(
  workspace: string,
  slug: string,
  proposal: StructuralProposal,
  state: import('../ingestion/state.js').IngestionState,
  memory: import('./types.js').OrchestratorMemory,
): void {
  const wikiDir = path.join(workspace, 'wikis', slug);
  const hierarchy = { ...memory.state.folderHierarchy };

  const renames = proposal.renamedFolders || [];
  const moves = proposal.movedFolders || [];
  const allRenames = [...renames, ...moves];

  for (const rename of allRenames) {
    const oldDir = path.join(wikiDir, rename.from);
    const newDir = path.join(wikiDir, rename.to);
    if (existsSync(oldDir)) {
      renameSync(oldDir, newDir);
    }

    const oldPrefix = `${rename.from}/`;
    const newPrefix = `${rename.to}/`;
    for (const sourceState of Object.values(state.sources)) {
      sourceState.documentPages = sourceState.documentPages.map((p) =>
        p.startsWith(oldPrefix) ? newPrefix + p.slice(oldPrefix.length) : p,
      );
      sourceState.rawPages = sourceState.rawPages.map((p) =>
        p.startsWith(oldPrefix) ? newPrefix + p.slice(oldPrefix.length) : p,
      );
    }
    for (const [pagePath, pageState] of Object.entries(state.pages || {})) {
      if (pagePath.startsWith(oldPrefix) || pageState.folder === rename.from) {
        const newPagePath = pagePath.startsWith(oldPrefix)
          ? newPrefix + pagePath.slice(oldPrefix.length)
          : pagePath;
        if (newPagePath !== pagePath) {
          state.pages![newPagePath] = { ...pageState, folder: rename.to };
          delete state.pages![pagePath];
        } else {
          pageState.folder = rename.to;
        }
      }
    }
    delete hierarchy[rename.from];
    hierarchy[rename.to] = {
      folder: rename.to,
      title: rename.title,
      description: rename.description,
      pageTypes: rename.pageTypes,
      children: rename.children,
    };
    memory.state.folderHierarchy[rename.to] = hierarchy[rename.to];
    delete memory.state.folderHierarchy[rename.from];
  }
}

export function parseProposalMarkdown(content: string): StructuralProposal | undefined {
  const parsed = matter(content);
  const data = parsed.data as Record<string, unknown>;
  if (data.type !== 'proposal') return undefined;

  const newFolderLines = (parsed.content.match(/- \*\*([^*]+)\*\* — (.+)/g) || []);
  const newFolderPlans: FolderPlan[] = [];
  for (const line of newFolderLines) {
    const match = line.match(/- \*\*([^*]+)\*\* — (.+): (.+)/);
    if (match) {
      newFolderPlans.push({
        folder: match[1].trim().replace(/\/$/, ''),
        title: match[2].trim(),
        description: match[3].trim(),
        pageTypes: ['document'],
        children: [],
      });
    }
  }

  const currentMatch = parsed.content.match(/## Current folders\n\n([\s\S]*?)(?=\n## |$)/);
  const currentFolders = currentMatch
    ? currentMatch[1].split('\n').map((l) => l.replace(/^- `/, '').replace(/`$/, '').trim()).filter(Boolean)
    : [];

  const proposedMatch = parsed.content.match(/## Proposed folders\n\n([\s\S]*?)(?=\n## |$)/);
  const proposedFolders = proposedMatch
    ? proposedMatch[1].split('\n').map((l) => l.replace(/^- `/, '').replace(/`$/, '').trim()).filter(Boolean)
    : [];

  const reasonMatch = parsed.content.match(/## Reason\n\n([\s\S]*?)(?=\n## |$)/);
  const reason = reasonMatch ? reasonMatch[1].trim() : 'Structural change proposed.';

  const renamedFolders = parseRenameMoveSection(parsed.content, '## Renamed folders');
  const movedFolders = parseRenameMoveSection(parsed.content, '## Moved folders');

  return {
    type: newFolderPlans.length === 1 && currentFolders.length > 0 && renamedFolders.length === 0 && movedFolders.length === 0 ? 'new-folder' : 'restructure',
    reason,
    currentFolders,
    proposedFolders,
    newFolderPlans,
    renamedFolders: renamedFolders.length > 0 ? renamedFolders : undefined,
    movedFolders: movedFolders.length > 0 ? movedFolders : undefined,
  };
}

function parseRenameMoveSection(
  content: string,
  header: string,
): { from: string; to: string; title: string; description: string; pageTypes: string[]; children: string[] }[] {
  const regex = new RegExp(`${header.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\n\n([\\s\\S]*?)(?=\n## |$)`);
  const match = content.match(regex);
  if (!match) return [];

  const lines = match[1].split('\n').filter((l) => l.trim().startsWith('- '));
  const result: { from: string; to: string; title: string; description: string; pageTypes: string[]; children: string[] }[] = [];
  for (const line of lines) {
    const parsed = line.match(/- \*\*([^*]+)\*\* → \*\*([^*]+)\*\* — (.+): (.+)/);
    if (parsed) {
      result.push({
        from: parsed[1].trim().replace(/\/$/, ''),
        to: parsed[2].trim().replace(/\/$/, ''),
        title: parsed[3].trim(),
        description: parsed[4].trim(),
        pageTypes: ['document'],
        children: [],
      });
    }
  }
  return result;
}

export function detectNewPageTypes(
  folderHierarchy: Record<string, FolderPlan>,
  pages: PagePlan[],
): Map<string, Set<string>> {
  const knownTypes = new Map<string, Set<string>>();
  for (const folder of Object.values(folderHierarchy)) {
    knownTypes.set(folder.folder, new Set(folder.pageTypes));
  }

  const newTypes = new Map<string, Set<string>>();
  for (const page of pages) {
    const folder = page.folder;
    const known = knownTypes.get(folder) ?? new Set<string>();
    if (!known.has(page.pageType)) {
      let set = newTypes.get(folder);
      if (!set) {
        set = new Set<string>();
        newTypes.set(folder, set);
      }
      set.add(page.pageType);
    }
  }
  return newTypes;
}

export function updateFolderIndexForNewPageTypes(
  filePath: string,
  newPageTypes: string[],
): void {
  if (!existsSync(filePath) || newPageTypes.length === 0) return;

  const content = readFileSync(filePath, 'utf-8');
  const parsed = matter(content);
  const body = String(parsed.content);

  let updated = body;
  updated = updated.replace(/(## Page Types\n\n)([\s\S]*?)(?=\n## |$)/, (match, header, list) => {
    const existing = list.split('\n').map((l: string) => l.replace(/^- `/, '').replace(/`$/, '').trim()).filter(Boolean);
    const merged = [...new Set([...existing, ...newPageTypes])];
    return header + merged.map((t) => `- \`${t}\``).join('\n') + '\n';
  });

  updated = updated.replace(/(## Naming Convention\n\n)([\s\S]*?)(?=\n## |$)/, (match, header, text) => {
    const extra = newPageTypes
      .filter((t) => !text.includes(`\`${t}\``))
      .map((t) => `- \`${t}\` pages follow the folder naming convention.`);
    if (extra.length === 0) return match;
    return header + text.trimEnd() + '\n' + extra.join('\n') + '\n';
  });

  parsed.data.updated = new Date().toISOString();
  writeFileSync(filePath, matter.stringify(updated, parsed.data));
}

export function updateAgentsMdForNewPageTypes(
  filePath: string,
  folder: string,
  newPageTypes: string[],
): void {
  if (!existsSync(filePath) || newPageTypes.length === 0) return;

  const content = readFileSync(filePath, 'utf-8');
  const parsed = matter(content);
  let body = String(parsed.content);

  const sectionRegex = /(## Page Types\n\n)([\s\S]*?)(?=\n## |$)/;
  if (!sectionRegex.test(body)) {
    body += '\n\n## Page Types\n\n';
  }

  body = body.replace(sectionRegex, (match, header, tableAndText) => {
    const rows: string[] = [];
    const lines = tableAndText.split('\n');
    for (const line of lines) {
      const rowMatch = line.match(/^\| `([^`]+)` \| ([^|]+) \|/);
      if (rowMatch) rows.push(rowMatch[1].trim());
    }
    const added = newPageTypes.filter((t) => !rows.includes(t));
    if (added.length === 0) return match;
    const newRows = added.map((t) => `| \`${t}\` | Auto-discovered page type in \`${folder}/\` | \`title\`, \`type\`, \`updated\`, \`wiki\` |`);
    return header + tableAndText.trimEnd() + '\n' + newRows.join('\n') + '\n';
  });

  parsed.data.updated = new Date().toISOString();
  writeFileSync(filePath, matter.stringify(body, parsed.data));
}

export function getApprovedProposalPaths(workspace: string, slug: string): string[] {
  const proposalsDir = path.join(workspace, '.kimi-code', 'proposals');
  if (!existsSync(proposalsDir)) return [];
  const files = readdirSync(proposalsDir);
  return files
    .filter((f) => f.includes(`-${slug}-structural-change`) && f.endsWith('.md'))
    .map((f) => path.join(proposalsDir, f));
}

export function folderPlacementsFromProposal(
  previousHierarchy: Record<string, FolderPlan>,
  proposal: StructuralProposal,
): FolderPlan[] {
  const merged = { ...previousHierarchy };
  // Apply renames/moves so the resolved hierarchy uses the new folder names.
  const allRenames = [...(proposal.renamedFolders || []), ...(proposal.movedFolders || [])];
  for (const rename of allRenames) {
    delete merged[rename.from];
    merged[rename.to] = {
      folder: rename.to,
      title: rename.title,
      description: rename.description,
      pageTypes: rename.pageTypes,
      children: rename.children,
    };
  }
  for (const folder of proposal.newFolderPlans) {
    merged[folder.folder] = folder;
  }
  return Object.values(merged);
}

export function collectPageTypesPerFolder(pages: PagePlan[]): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  for (const page of pages) {
    let set = map.get(page.folder);
    if (!set) {
      set = new Set<string>();
      map.set(page.folder, set);
    }
    set.add(page.pageType);
  }
  return map;
}

export function syncFolderPageTypes(folderPlacements: FolderPlan[], pages: PagePlan[]): void {
  const perFolder = collectPageTypesPerFolder(pages);
  for (const folder of folderPlacements) {
    const types = perFolder.get(folder.folder) ?? new Set(folder.pageTypes);
    for (const t of folder.pageTypes) types.add(t);
    folder.pageTypes = Array.from(types);
  }
}
