import React, { useEffect, useState } from 'react';
import { Box, Text, useInput, useStdin } from 'ink';
import { readdir, readFile } from 'node:fs/promises';
import type { Dirent } from 'node:fs';
import { join } from 'node:path';
import { Header } from './header';
import { Footer } from './footer';
import { useWikiList } from '../hooks/use-wiki-list';

type TreeNode =
  | { type: 'folder'; name: string; path: string; depth: number; expanded: boolean }
  | { type: 'file'; name: string; path: string; depth: number };

type Mode = 'wiki' | 'tree' | 'viewer';

const VIEWER_LINES = 14;
const VIEWER_PAGE_STEP = 10;

async function buildTreeNodes(rootPath: string, rootName: string): Promise<TreeNode[]> {
  const root: TreeNode = { type: 'folder', name: rootName, path: rootName, depth: 0, expanded: true };
  const result: TreeNode[] = [root];

  async function scan(dirPath: string, parentPath: string, depth: number): Promise<TreeNode[]> {
    let entries: Dirent[];
    try {
      entries = await readdir(dirPath, { withFileTypes: true });
    } catch {
      return [];
    }

    const folders = entries.filter((e) => e.isDirectory()).sort((a, b) => a.name.localeCompare(b.name));
    const files = entries
      .filter((e) => e.isFile() && e.name.toLowerCase().endsWith('.md'))
      .sort((a, b) => a.name.localeCompare(b.name));

    const nodes: TreeNode[] = [];
    for (const folder of folders) {
      const path = parentPath.endsWith('/') ? `${parentPath}${folder.name}` : `${parentPath}/${folder.name}`;
      nodes.push({ type: 'folder', name: folder.name, path, depth, expanded: false });
      const childNodes = await scan(join(dirPath, folder.name), path, depth + 1);
      nodes.push(...childNodes);
    }
    for (const file of files) {
      const path = parentPath.endsWith('/') ? `${parentPath}${file.name}` : `${parentPath}/${file.name}`;
      nodes.push({ type: 'file', name: file.name, path, depth });
    }
    return nodes;
  }

  result.push(...(await scan(rootPath, rootName, 1)));
  return result;
}

function visibleNodes(nodes: TreeNode[]): TreeNode[] {
  const result: TreeNode[] = [];
  for (let index = 0; index < nodes.length; index++) {
    const node = nodes[index];
    result.push(node);
    if (node.type === 'folder' && !node.expanded) {
      const depth = node.depth;
      index++;
      while (index < nodes.length && nodes[index].depth > depth) {
        index++;
      }
      index--;
    }
  }
  return result;
}

function parentIndexOf(nodes: TreeNode[], index: number): number | null {
  const depth = nodes[index].depth;
  for (let i = index - 1; i >= 0; i--) {
    if (nodes[i].type === 'folder' && nodes[i].depth < depth) {
      return i;
    }
  }
  return null;
}

function toggleNode(nodes: TreeNode[], index: number): TreeNode[] {
  const copy = [...nodes];
  const node = copy[index];
  if (node?.type === 'folder') {
    copy[index] = { ...node, expanded: !node.expanded };
  }
  return copy;
}

export interface TreeBrowserProps {
  workspace?: string;
  wiki?: string;
  rootFolder: string; // e.g. 'entities/' or 'topics/'
  title: string;
  onBack: () => void;
}

export function TreeBrowser({ workspace = '.', wiki, rootFolder, title, onBack }: TreeBrowserProps) {
  const { isRawModeSupported } = useStdin();
  const wikis = useWikiList(workspace);
  const [mode, setMode] = useState<Mode>(wiki ? 'tree' : 'wiki');
  const [wikiIndex, setWikiIndex] = useState(0);
  const selectedWiki = wikis.length > 0 ? wikis[Math.min(wikiIndex, wikis.length - 1)] : undefined;
  const [activeWiki, setActiveWiki] = useState<string | undefined>(wiki);
  const [nodes, setNodes] = useState<TreeNode[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [viewerContent, setViewerContent] = useState('');
  const [viewerScroll, setViewerScroll] = useState(0);
  const [error, setError] = useState('');

  const rootPath = activeWiki ? join(workspace, 'wikis', activeWiki, rootFolder) : null;

  useEffect(() => {
    if (!rootPath) {
      setNodes([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const tree = await buildTreeNodes(rootPath, rootFolder);
        if (!cancelled) {
          setNodes(tree);
          setSelectedIndex(0);
        }
      } catch (err) {
        if (!cancelled) {
          setError((err as Error).message);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [rootPath, rootFolder]);

  const visible = visibleNodes(nodes);

  const openFile = async (path: string) => {
    if (!activeWiki) {
      return;
    }
    try {
      const content = await readFile(join(workspace, 'wikis', activeWiki, path), 'utf-8');
      setViewerContent(content);
      setViewerScroll(0);
      setMode('viewer');
    } catch (err) {
      setError((err as Error).message);
    }
  };

  useInput(
    (_input, key) => {
      if (mode === 'viewer') {
        if (key.escape) {
          setMode('tree');
          setViewerContent('');
          return;
        }
        const maxScroll = Math.max(0, viewerContent.split('\n').length - VIEWER_LINES);
        if (key.upArrow) {
          setViewerScroll((offset) => Math.max(0, offset - 1));
        } else if (key.downArrow) {
          setViewerScroll((offset) => Math.min(maxScroll, offset + 1));
        } else if (key.pageUp) {
          setViewerScroll((offset) => Math.max(0, offset - VIEWER_PAGE_STEP));
        } else if (key.pageDown) {
          setViewerScroll((offset) => Math.min(maxScroll, offset + VIEWER_PAGE_STEP));
        }
        return;
      }

      if (mode === 'wiki') {
        if (wikis.length === 0) {
          return;
        }
        if (key.upArrow) {
          setWikiIndex((index) => (index + wikis.length - 1) % wikis.length);
        } else if (key.downArrow) {
          setWikiIndex((index) => (index + 1) % wikis.length);
        } else if (key.return && selectedWiki) {
          setActiveWiki(selectedWiki);
          setMode('tree');
        } else if (key.escape) {
          onBack();
        }
        return;
      }

      if (key.escape) {
        if (wiki) {
          onBack();
        } else {
          setMode('wiki');
          setActiveWiki(undefined);
          setNodes([]);
        }
        return;
      }

      if (visible.length === 0) {
        return;
      }

      if (key.upArrow) {
        setSelectedIndex((index) => (index + visible.length - 1) % visible.length);
      } else if (key.downArrow) {
        setSelectedIndex((index) => (index + 1) % visible.length);
      } else if (key.leftArrow) {
        const node = visible[selectedIndex];
        if (node?.type === 'folder' && node.expanded) {
          setNodes((prev) => toggleNode(prev, nodes.indexOf(node)));
        } else {
          const parent = parentIndexOf(nodes, nodes.indexOf(node));
          if (parent !== null) {
            const parentVisibleIndex = visible.findIndex((n) => n.path === nodes[parent].path);
            if (parentVisibleIndex >= 0) {
              setSelectedIndex(parentVisibleIndex);
            }
          }
        }
      } else if (key.rightArrow) {
        const node = visible[selectedIndex];
        if (node?.type === 'folder' && !node.expanded) {
          setNodes((prev) => toggleNode(prev, nodes.indexOf(node)));
        }
      } else if (key.return) {
        const node = visible[selectedIndex];
        if (node?.type === 'file') {
          void openFile(node.path);
        } else if (node?.type === 'folder') {
          setNodes((prev) => toggleNode(prev, nodes.indexOf(node)));
        }
      }
    },
    { isActive: isRawModeSupported === true },
  );

  const footerText =
    mode === 'viewer'
      ? 'Up/Down: scroll | PageUp/PageDown: page | Escape: back to tree'
      : mode === 'wiki'
        ? 'Up/Down: select wiki | Enter: choose | Escape: back'
        : 'Up/Down: select | Right: expand | Left: collapse | Enter: open | Escape: back';

  return (
    <Box flexDirection="column">
      <Header />
      <Text bold>{title}</Text>
      {!isRawModeSupported ? (
        <Box flexDirection="column" marginTop={1}>
          {activeWiki && nodes.filter((node) => node.type === 'file').map((node) => <Text key={node.path}>{node.path}</Text>)}
          {!activeWiki && wikis.map((w) => <Text key={w}>{w}</Text>)}
          <Text dimColor>Interactive tree browsing requires a TTY.</Text>
        </Box>
      ) : mode === 'wiki' ? (
        <Box flexDirection="column" marginTop={1}>
          {wikis.length === 0 ? (
            <Text dimColor>No wikis found. Create one first (init).</Text>
          ) : (
            wikis.map((w, index) => (
              <Text key={w} color={index === wikiIndex ? 'cyan' : undefined}>
                {index === wikiIndex ? '> ' : '  '}
                {w}
              </Text>
            ))
          )}
        </Box>
      ) : mode === 'tree' ? (
        <Box flexDirection="column" marginTop={1}>
          {error ? (
            <Text color="red">{error}</Text>
          ) : visible.length === 0 ? (
            <Text dimColor>No {rootFolder.replace(/\/$/, '')} found. Run ingest first.</Text>
          ) : (
            visible.map((node, index) => {
              const indent = '  '.repeat(node.depth);
              const marker = index === selectedIndex ? '> ' : '  ';
              const icon = node.type === 'folder' ? (node.expanded ? 'v ' : '> ') : '  ';
              const displayName = node.type === 'folder' ? `${node.name}/` : node.name;
              return (
                <Text key={node.path} color={index === selectedIndex ? 'cyan' : undefined}>
                  {marker}
                  {indent}
                  {icon}
                  {displayName}
                </Text>
              );
            })
          )}
        </Box>
      ) : (
        <Box flexDirection="column" marginTop={1}>
          <Text dimColor>
            Viewer — lines {viewerScroll + 1}-
            {Math.min(viewerScroll + VIEWER_LINES, viewerContent.split('\n').length)} of{' '}
            {viewerContent.split('\n').length}
          </Text>
          {viewerContent
            .split('\n')
            .slice(viewerScroll, viewerScroll + VIEWER_LINES)
            .map((line, index) => (
              <Text key={viewerScroll + index}>{line}</Text>
            ))}
        </Box>
      )}
      <Footer helpText={footerText} />
    </Box>
  );
}
