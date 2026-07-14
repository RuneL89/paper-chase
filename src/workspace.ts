import { readdirSync, statSync, existsSync, mkdirSync } from 'fs';
import path from 'path';
import { CLIError } from './errors.js';

export function discoverWikis(workspace: string): string[] {
  if (!existsSync(workspace)) {
    throw new CLIError(`Workspace not found: ${workspace}. Please create the workspace directory first.`);
  }

  const wikisDir = path.join(workspace, 'wikis');
  if (!existsSync(wikisDir)) {
    throw new CLIError(
      `This folder does not have a wikis/ directory. ` +
      `Create a wikis/ folder and add wiki folders that contain a raw/ subfolder.`,
    );
  }

  const entries = readdirSync(wikisDir);
  const wikis: string[] = [];

  for (const entry of entries) {
    const wikiPath = path.join(wikisDir, entry);
    const rawPath = path.join(wikiPath, 'raw');
    if (statSync(wikiPath).isDirectory() && existsSync(rawPath)) {
      wikis.push(entry);
    }
  }

  return wikis.sort();
}

export function wikiPath(workspace: string, slug: string): string {
  return path.join(workspace, 'wikis', slug);
}

export function wikiRawPath(workspace: string, slug: string): string {
  return path.join(wikiPath(workspace, slug), 'raw');
}

export function ensureWikiExists(workspace: string, slug: string): string {
  const wikiDir = wikiPath(workspace, slug);
  const rawDir = path.join(wikiDir, 'raw');
  mkdirSync(wikiDir, { recursive: true });
  mkdirSync(rawDir, { recursive: true });
  return wikiDir;
}

export function isInsideRawFolder(
  workspace: string,
  slug: string,
  pdfPath: string,
): boolean {
  const rawDir = path.resolve(wikiRawPath(workspace, slug));
  const resolved = path.resolve(workspace, pdfPath);
  return resolved.startsWith(rawDir + path.sep) || resolved === rawDir;
}

export function toRelativePath(workspace: string, filePath: string): string {
  const resolved = path.resolve(workspace, filePath);
  const relative = path.relative(workspace, resolved);
  return relative.replace(/\\/g, '/');
}

export function workspaceExists(workspace: string): boolean {
  return existsSync(workspace);
}

export function listWikiRawPdfs(workspace: string, slug: string): string[] {
  const rawDir = wikiRawPath(workspace, slug);
  if (!existsSync(rawDir)) {
    return [];
  }
  return readdirSync(rawDir)
    .filter((f) => f.toLowerCase().endsWith('.pdf'))
    .sort();
}

export function toRelativePathFromDir(dir: string, filePath: string): string {
  const resolved = path.resolve(dir, filePath);
  const relative = path.relative(dir, resolved);
  return relative.replace(/\\/g, '/');
}

