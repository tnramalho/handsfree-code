import assert from 'node:assert/strict';
import { test } from 'node:test';
import { wavFromPcm } from './mic.js';

test('wav header describes 16 kHz mono 16-bit PCM', () => {
  const wav = wavFromPcm(Buffer.alloc(3200));
  assert.equal(wav.toString('ascii', 0, 4), 'RIFF');
  assert.equal(wav.readUInt32LE(24), 16000);
  assert.equal(wav.readUInt16LE(22), 1);
  assert.equal(wav.readUInt32LE(40), 3200);
  assert.equal(wav.length, 3244);
});
