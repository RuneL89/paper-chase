/**
 * Minimal line-based diff (Phase 9, TUI AGENTS.md review screen). Classic
 * LCS over lines; produces a compact op list with added/removed counts.
 * Deterministic, dependency-free, and adequate for constitution-sized files
 * (a few hundred lines).
 */

export type DiffOp =
  | { kind: 'context'; line: string }
  | { kind: 'added'; line: string }
  | { kind: 'removed'; line: string };

export interface LineDiff {
  ops: DiffOp[];
  added: number;
  removed: number;
}

export function diffLines(before: string, after: string): LineDiff {
  const a = before.split('\n');
  const b = after.split('\n');

  // LCS length table.
  const lengths: number[][] = Array.from({ length: a.length + 1 }, () =>
    new Array<number>(b.length + 1).fill(0),
  );
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      lengths[i][j] =
        a[i] === b[j]
          ? lengths[i + 1][j + 1] + 1
          : Math.max(lengths[i + 1][j], lengths[i][j + 1]);
    }
  }

  const ops: DiffOp[] = [];
  let added = 0;
  let removed = 0;
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      ops.push({ kind: 'context', line: a[i] });
      i++;
      j++;
    } else if (lengths[i + 1][j] >= lengths[i][j + 1]) {
      ops.push({ kind: 'removed', line: a[i] });
      removed++;
      i++;
    } else {
      ops.push({ kind: 'added', line: b[j] });
      added++;
      j++;
    }
  }
  while (i < a.length) {
    ops.push({ kind: 'removed', line: a[i] });
    removed++;
    i++;
  }
  while (j < b.length) {
    ops.push({ kind: 'added', line: b[j] });
    added++;
    j++;
  }

  return { ops, added, removed };
}

/**
 * Collapse a full diff into display hunks: runs of changes with up to
 * `contextLines` of surrounding context, separated by a marker line.
 */
export function diffHunks(diff: LineDiff, contextLines = 2): string[] {
  const changed = diff.ops.map((op, index) => ({ op, index })).filter(({ op }) => op.kind !== 'context');
  if (changed.length === 0) {
    return ['(no changes)'];
  }

  const keep = new Set<number>();
  for (const { index } of changed) {
    for (let k = Math.max(0, index - contextLines); k <= Math.min(diff.ops.length - 1, index + contextLines); k++) {
      keep.add(k);
    }
  }

  const lines: string[] = [];
  let previous = -1;
  for (const index of Array.from(keep).sort((x, y) => x - y)) {
    if (previous !== -1 && index > previous + 1) {
      lines.push('...');
    }
    const op = diff.ops[index];
    lines.push(op.kind === 'added' ? `+ ${op.line}` : op.kind === 'removed' ? `- ${op.line}` : `  ${op.line}`);
    previous = index;
  }
  return lines;
}
