import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const git = (cwd: string, args: string[]) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

/** The main checkout, even when `cwd` is already inside one of its worktrees. */
export function mainRepoRoot(cwd: string): string {
  const common = path.resolve(cwd, git(cwd, ['rev-parse', '--git-common-dir']));
  return path.basename(common) === '.git' ? path.dirname(common) : git(cwd, ['rev-parse', '--show-toplevel']);
}

/**
 * Creates (or reuses) a worktree for `branch` next to the main repo: <repo>-wt/<branch>.
 * Returns the worktree path.
 */
export function ensureWorktree(cwd: string, branch: string): string {
  const root = mainRepoRoot(cwd);
  const safe = branch.replace(/[^\w.-]+/g, '-');
  const dir = path.join(path.dirname(root), `${path.basename(root)}-wt`, safe);
  if (fs.existsSync(dir)) return dir;
  fs.mkdirSync(path.dirname(dir), { recursive: true });
  let exists = true;
  try {
    git(root, ['rev-parse', '--verify', '--quiet', `refs/heads/${branch}`]);
  } catch {
    exists = false;
  }
  git(root, exists ? ['worktree', 'add', dir, branch] : ['worktree', 'add', '-b', branch, dir]);
  return dir;
}

export function currentBranch(cwd: string): string {
  try {
    return git(cwd, ['branch', '--show-current']) || '(sem branch)';
  } catch {
    return '(fora de repositório git)';
  }
}
