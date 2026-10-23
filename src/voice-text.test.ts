import assert from 'node:assert/strict';
import { test } from 'node:test';
import { forVoice } from './voice-text.js';

test('short answers are spoken whole', () => {
  assert.equal(forVoice('Criei a branch. Testes rodando.'), 'Criei a branch. Testes rodando.');
});

test('long answers keep two sentences and point to the terminal', () => {
  const out = forVoice('Mudei o Node. Rodei os testes. Passaram 40. Atualizei o changelog.');
  assert.equal(out, 'Mudei o Node. Rodei os testes. O resto tá no terminal.');
});

test('a closing question is never dropped', () => {
  const out = forVoice('Mudei o Node. Rodei os testes. Passaram 40. Faço o commit?');
  assert.equal(out, 'Mudei o Node. Faço o commit?');
});

test('one huge sentence is cut at a word', () => {
  const out = forVoice('palavra '.repeat(100));
  assert.ok(out.length < 340);
  assert.ok(out.endsWith('... O resto tá no terminal.'));
});
