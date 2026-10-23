import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { ensureWorktree } from './worktree.js';

test('a worktree created from inside another worktree goes next to the main repo, not nested', () => {
  const base = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'voz-wt-')));
  const repo = path.join(base, 'proj');
  fs.mkdirSync(repo);
  const git = (cwd: string, ...args: string[]) => execFileSync('git', args, { cwd, stdio: 'ignore' });
  git(repo, 'init', '-q');
  git(repo, '-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '--allow-empty', '-m', 'init');

  const a = ensureWorktree(repo, 'fix-a');
  const b = ensureWorktree(a, 'fix-b');
  assert.equal(a, path.join(base, 'proj-wt', 'fix-a'));
  assert.equal(b, path.join(base, 'proj-wt', 'fix-b'));
  assert.equal(ensureWorktree(repo, 'fix-a'), a);
  fs.rmSync(base, { recursive: true, force: true });
});
