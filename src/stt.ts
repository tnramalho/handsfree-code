import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';
import { wavFromPcm } from './mic.js';

const WORKER = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'stt_worker.py');

// Whisper invents these whole phrases on silence or road noise. Only an exact match is dropped,
// so "Obrigado James, agora roda os testes" still goes through.
const HALLUCINATIONS = /^(obrigad[oa]( por assistir)?|legendas?( pela comunidade.*)?|tchau,? tchau|amara\.org|inscreva-se.*|\.+)[.!]?$/i;

let vocabulary = '';
let worker: ChildProcess | null = null;
let workerReady: Promise<void> | null = null;
const waiting: Array<{ resolve: (text: string) => void; reject: (err: Error) => void }> = [];

function failWorker(err: Error): void {
  worker = null;
  workerReady = null;
  for (const w of waiting.splice(0)) w.reject(err);
}

function startLocalWorker(): Promise<void> {
  if (workerReady) return workerReady;
  workerReady = new Promise((resolve, reject) => {
    const proc = spawn(config.python, [WORKER], {
      env: { ...process.env, VOZ_STT_MODEL: config.sttModel, VOZ_STT_PROMPT: vocabulary },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    worker = proc;
    const fail = (err: Error) => {
      reject(err);
      failWorker(err);
    };
    proc.on('error', (err) => fail(new Error(`transcrição local não abriu (${err.message}). Veja a instalação do Python no README.`)));
    proc.on('exit', (code) => fail(new Error(`transcrição local saiu (código ${code}).`)));
    proc.stdin!.on('error', () => {});
    let buf = '';
    proc.stdout!.on('data', (d: Buffer) => {
      buf += d.toString();
      let nl: number;
      while ((nl = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, nl);
        buf = buf.slice(nl + 1);
        if (line === 'ready') {
          console.log('  (transcrição local pronta)');
          resolve();
        } else if (line.startsWith('text ')) waiting.shift()?.resolve(line.slice(5).trim());
      }
    });
  });
  return workerReady;
}

async function transcribeLocal(wav: Buffer): Promise<string> {
  await startLocalWorker();
  const file = path.join(os.tmpdir(), `voz-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}.wav`);
  fs.writeFileSync(file, wav);
  try {
    return await new Promise<string>((resolve, reject) => {
      waiting.push({ resolve, reject });
      worker!.stdin!.write(file + '\n');
    });
  } finally {
    fs.rmSync(file, { force: true });
  }
}

async function transcribeOpenAI(wav: Buffer, timeoutMs: number): Promise<string> {
  const form = new FormData();
  form.append('file', new Blob([new Uint8Array(wav)], { type: 'audio/wav' }), 'fala.wav');
  form.append('model', 'gpt-4o-mini-transcribe');
  form.append('language', 'pt');
  if (vocabulary) form.append('prompt', vocabulary);
  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.openaiKey}` },
    body: form,
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`OpenAI transcrição ${res.status}`);
  return String(((await res.json()) as { text?: string }).text ?? '').trim();
}

/** `name` biases the transcription so the assistant's name comes out spelled right. */
export function warmUpLocal(name: string): void {
  vocabulary = `${name}, git, branch, worktree, commit, testes, deploy.`;
  if (!config.openaiKey) startLocalWorker().catch(() => {});
}

/**
 * Returns '' for silence, noise, or when no transcription works (e.g. no signal and no local
 * model). Never throws, so losing the network on the road does not take the app down.
 * `quick` is for barge-in windows: short timeout and no slow local fallback.
 */
export async function transcribe(pcm: Buffer, opts: { quick?: boolean } = {}): Promise<string> {
  const wav = wavFromPcm(pcm);
  let text: string | null = null;
  if (config.openaiKey) {
    try {
      text = await transcribeOpenAI(wav, opts.quick ? 4000 : 15000);
    } catch (err) {
      if (opts.quick) return '';
      console.error(`  (OpenAI falhou, usando transcrição local: ${(err as Error).message})`);
    }
  }
  if (text === null) {
    if (opts.quick) return '';
    try {
      text = await transcribeLocal(wav);
    } catch (err) {
      console.error(`  (sem transcrição: ${(err as Error).message})`);
      return '';
    }
  }
  if (!text || HALLUCINATIONS.test(text)) {
    if (text) console.log(`  (ignorei ruído transcrito como "${text}")`);
    return '';
  }
  return text;
}

export function stopStt(): void {
  worker?.kill();
}
