import assert from 'node:assert/strict';
import { test } from 'node:test';
import { wakeMatcher } from './wake.js';

const james = wakeMatcher('James');

test('recognizes the name with the request after it', () => {
  assert.deepEqual(james('James, como a gente tá?'), { addressed: true, rest: 'como a gente tá?' });
  assert.deepEqual(james('Ô James, roda os testes'), { addressed: true, rest: 'roda os testes' });
  assert.deepEqual(james('Ei James. Cria uma branch nova.'), { addressed: true, rest: 'Cria uma branch nova.' });
});

test('name alone means "listen to me"', () => {
  assert.deepEqual(james('James.'), { addressed: true, rest: '' });
  assert.deepEqual(james('Oi, James!'), { addressed: true, rest: '' });
});

test('name at the end still counts', () => {
  assert.deepEqual(james('roda os testes aí, James'), { addressed: true, rest: 'roda os testes aí' });
});

test('accepts how speech-to-text spells James in Portuguese', () => {
  assert.equal(james('Djeims, para').addressed, true);
  assert.equal(james('Jeimes, e aí?').addressed, true);
  assert.equal(james('JAMES').addressed, true);
});

test('ignores talk that does not call the name', () => {
  assert.equal(james('vou buscar as crianças às cinco').addressed, false);
  assert.equal(james('o Jaime ligou mais cedo').addressed, false);
  assert.equal(james('jamesonite é um mineral').addressed, false);
});

test('afterOnly drops what came before the name (the assistant\'s own voice during a barge-in)', () => {
  const after = wakeMatcher('James', [], { afterOnly: true });
  assert.deepEqual(after('mudei a versão James para'), { addressed: true, rest: 'para' });
  assert.deepEqual(after('então... James'), { addressed: true, rest: '' });
});

test('works with another name and extra spellings', () => {
  const ana = wakeMatcher('Ana', ['anna']);
  assert.deepEqual(ana('Anna, abre o worktree da branch x'), { addressed: true, rest: 'abre o worktree da branch x' });
  assert.equal(ana('banana').addressed, false);
});
