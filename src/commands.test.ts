import assert from 'node:assert/strict';
import { test } from 'node:test';
import { NO, QUIT_WORDS, WORKTREE_CMD, isStop, isYes } from './commands.js';

test('stop only when the stop word comes first', () => {
  for (const t of ['para', 'Para!', 'pare agora', 'stop', 'Stop.', 'cancela', 'wait']) assert.ok(isStop(t), t);
  for (const t of ['roda para mim', 'vou para casa', 'separa os arquivos', 'run the tests', 'bus stop']) assert.ok(!isStop(t), t);
});

test('confirmation answers in both languages', () => {
  for (const t of ['confirma', 'Confirma.', 'sim', 'Sim, confirma', 'pode sim', 'yes', 'Confirm.']) assert.ok(isYes(t), t);
  for (const t of ['pode parar', 'pode esperar', 'pode cancelar', 'faz outra coisa primeiro', 'vai devagar', 'pode', 'confirma, ou James, não', 'não']) assert.ok(!isYes(t), t);
  for (const t of ['não', 'nao', 'No.', "don't", 'cancela', 'espera']) assert.ok(NO.test(t), t);
  assert.ok(!NO.test('nossa, confirma'));
});

test('quit words', () => {
  for (const t of ['tchau', 'Tchau.', 'bye', 'quit']) assert.ok(QUIT_WORDS.test(t), t);
  assert.ok(!QUIT_WORDS.test('tchau pra esse bug, corrige ele'));
});

test('worktree requests', () => {
  assert.equal('abre o worktree da branch fix/login'.match(WORKTREE_CMD)?.[2], 'fix/login');
  assert.equal('open the worktree for branch feat-x'.match(WORKTREE_CMD)?.[2], 'feat-x');
  assert.equal('switch to worktree hotfix'.match(WORKTREE_CMD)?.[2], 'hotfix');
  assert.equal('o que é um worktree?'.match(WORKTREE_CMD), null);
});
