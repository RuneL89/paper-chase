import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import path from 'path';
import matter from 'gray-matter';

export interface LogEntrySource {
  filePath: string;
  sha256?: string;
  status: 'added' | 'changed' | 'removed' | 'unchanged';
}

export interface LogEntryPage {
  filePath: string;
  action: 'created' | 'updated' | 'deleted' | 'moved';
  from?: string;
}

export interface LogEntry {
  timestamp: string;
  command: string;
  sources: LogEntrySource[];
  pages: LogEntryPage[];
  structuralChanges?: string[];
  errors: string[];
  warnings: string[];
  quarantined?: string[];
}

export function logPath(wikiDir: string): string {
  return path.join(wikiDir, 'log.md');
}

export function appendLogEntry(wikiDir: string, entry: LogEntry): string {
  const filePath = logPath(wikiDir);
  mkdirSync(path.dirname(filePath), { recursive: true });

  const existing = existsSync(filePath) ? readFileSync(filePath, 'utf-8') : '';
  const parsed = existing ? matter(existing) : { content: '', data: {} };
  const header = parsed.content.trim() || '# Ingestion Log\n\nAppend-only record of ingestion runs and structural changes.';

  const lines: string[] = [
    '',
    `## ${entry.timestamp} — ${entry.command}`,
    '',
    '### Sources',
    '',
    ...entry.sources.map((s) => `- \`${s.filePath}\` (${s.status})${s.sha256 ? ` — ${s.sha256}` : ''}`),
    '',
    '### Pages',
    '',
    ...(entry.pages.length > 0
      ? entry.pages.map((p) => `- \`${p.filePath}\` (${p.action})${p.from ? ` from \`${p.from}\`` : ''}`)
      : ['- No pages changed.']),
    '',
  ];

  if (entry.structuralChanges && entry.structuralChanges.length > 0) {
    lines.push('### Structural Changes');
    lines.push('');
    lines.push(...entry.structuralChanges.map((c) => `- ${c}`));
    lines.push('');
  }

  if (entry.quarantined && entry.quarantined.length > 0) {
    lines.push('### Quarantined Chunks');
    lines.push('');
    lines.push(...entry.quarantined.map((q) => `- ${q}`));
    lines.push('');
  }

  if (entry.errors.length > 0 || entry.warnings.length > 0) {
    lines.push('### Issues');
    lines.push('');
    for (const error of entry.errors) {
      lines.push(`- **ERROR:** ${error}`);
    }
    for (const warning of entry.warnings) {
      lines.push(`- **WARNING:** ${warning}`);
    }
    lines.push('');
  }

  const updatedContent = header + lines.join('\n');
  writeFileSync(filePath, matter.stringify(updatedContent, parsed.data));
  return filePath;
}

export function readLogEntries(wikiDir: string): string[] {
  const filePath = logPath(wikiDir);
  if (!existsSync(filePath)) return [];
  const parsed = matter(readFileSync(filePath, 'utf-8'));
  return String(parsed.content)
    .split(/^## /m)
    .slice(1);
}
