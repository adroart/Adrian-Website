import assert from 'node:assert/strict';
import { realpathSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { loadConfigFromFile } from 'vite';

describe('Vite worktree filesystem access', () => {
  it('allows the real dependency directory when node_modules is a worktree symlink', async () => {
    const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
    const loaded = await loadConfigFromFile(
      { command: 'serve', mode: 'test' },
      path.join(root, 'vite.config.ts'),
      root,
    );
    assert.ok(loaded);

    const allow = loaded.config.server?.fs?.allow ?? [];
    const dependencyRoot = realpathSync(path.join(root, 'node_modules'));
    assert.ok(allow.includes(dependencyRoot));
  });
});
