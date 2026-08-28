import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, expect, test } from 'vitest';
import { loadWorkspaceRegistry, registerWorkspace } from '../../src/tui/workspace-bootstrap';
import { loadSettings, saveSettings, settingsPath } from '../../src/tui/settings';

// 2026-08-28 (user-reported bug fix): the workspace bootstrap — how the TUI
// remembers which folders hold wikis. The registry (absolute folder paths +
// the last-used pointer) lives in the LAUNCH folder's `.paper-chase.json`;
// `registerWorkspace` also migrates the launch folder's settings into a
// workspace's own config ONCE. Hermetic: every helper takes an explicit
// `bootDir`, so tests run against temp folders and never touch the repo's
// real config files.

const tempDirs: string[] = [];

afterAll(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

function makeTempDir(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

test('an empty launch folder loads an empty registry with the cwd default', async () => {
  const boot = makeTempDir('paper-chase-boot-empty-');
  expect(await loadWorkspaceRegistry(boot)).toEqual({ workspaces: [], active: '.' });
});

test('a pre-registry workspace pointer back-seeds the registry', async () => {
  const boot = makeTempDir('paper-chase-boot-pointer-');
  const workspace = makeTempDir('paper-chase-ws-pointer-');
  const base = await loadSettings(boot);
  await saveSettings(boot, { ...base, workspace });

  const registry = await loadWorkspaceRegistry(boot);
  expect(registry.active).toBe(workspace);
  expect(registry.workspaces).toEqual([workspace]);
});

test('the registry is deduped on load and the pointer wins', async () => {
  const boot = makeTempDir('paper-chase-boot-dedupe-');
  const first = makeTempDir('paper-chase-ws-a-');
  const second = makeTempDir('paper-chase-ws-b-');
  const base = await loadSettings(boot);
  await saveSettings(boot, { ...base, workspace: second, workspaces: [first, second, first] });

  expect(await loadWorkspaceRegistry(boot)).toEqual({ workspaces: [first, second], active: second });
});

test('registerWorkspace persists the pointer and dedupe-adds to the registry', async () => {
  const boot = makeTempDir('paper-chase-boot-reg-');
  const workspace = makeTempDir('paper-chase-ws-reg-');
  const base = await loadSettings(boot);
  await saveSettings(boot, base);

  await registerWorkspace(workspace, boot);

  const after = await loadSettings(boot);
  expect(after.workspace).toBe(resolve(workspace));
  expect(after.workspaces).toEqual([resolve(workspace)]);
});

test('registerWorkspace migrates the launch folder settings into the workspace config ONCE', async () => {
  const boot = makeTempDir('paper-chase-boot-migrate-');
  const workspace = makeTempDir('paper-chase-ws-migrate-');
  const base = await loadSettings(boot);
  base.synthesis = true;
  base.updateAgents = true;
  base.apiKeys.zhipu = 'sk-test';
  await saveSettings(boot, base);

  await registerWorkspace(workspace, boot);

  // The boot config keeps its settings and gains the registry fields.
  const bootAfter = await loadSettings(boot);
  expect(bootAfter.synthesis).toBe(true);
  expect(bootAfter.apiKeys.zhipu).toBe('sk-test');
  expect(bootAfter.workspace).toBe(resolve(workspace));

  // The workspace inherited the settings but NOT the pointer/registry pair.
  const migrated = await loadSettings(workspace);
  expect(migrated.synthesis).toBe(true);
  expect(migrated.updateAgents).toBe(true);
  expect(migrated.apiKeys.zhipu).toBe('sk-test');
  expect(migrated.workspace).toBeUndefined();
  expect(migrated.workspaces).toBeUndefined();

  // An existing workspace config is never overwritten.
  const workspaceConfig = settingsPath(workspace);
  writeFileSync(workspaceConfig, '{"synthesis": false}\n');
  await registerWorkspace(workspace, boot);
  expect(readFileSync(workspaceConfig, 'utf-8')).toBe('{"synthesis": false}\n');
});

test('re-registering an existing workspace moves it to the end (active)', async () => {
  const boot = makeTempDir('paper-chase-boot-reorder-');
  const first = makeTempDir('paper-chase-ws-first-');
  const second = makeTempDir('paper-chase-ws-second-');
  const base = await loadSettings(boot);
  await saveSettings(boot, { ...base, workspace: second, workspaces: [first, second] });

  await registerWorkspace(first, boot);

  const after = await loadSettings(boot);
  expect(after.workspace).toBe(resolve(first));
  expect(after.workspaces).toEqual([resolve(second), resolve(first)]);
});

test('registering the launch folder itself clears the pointer and keeps the registry', async () => {
  const boot = makeTempDir('paper-chase-boot-clear-');
  const workspace = makeTempDir('paper-chase-ws-clear-');
  const base = await loadSettings(boot);
  await saveSettings(boot, { ...base, workspace, workspaces: [workspace] });

  await registerWorkspace(boot, boot);

  const after = await loadSettings(boot);
  expect(after.workspace).toBeUndefined();
  expect(after.workspaces).toEqual([workspace]);
});

test('workspace/workspaces round-trip through save/load with garbage tolerated', async () => {
  const boot = makeTempDir('paper-chase-boot-parse-');
  writeFileSync(
    settingsPath(boot),
    JSON.stringify({
      synthesis: true,
      workspace: 'C:\\wikis',
      workspaces: ['C:\\a', '', 42, 'C:\\a', null],
    }),
  );

  const loaded = await loadSettings(boot);
  expect(loaded.synthesis).toBe(true);
  expect(loaded.workspace).toBe('C:\\wikis');
  expect(loaded.workspaces).toEqual(['C:\\a']);
});
