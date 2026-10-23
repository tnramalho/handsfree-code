import { spawn } from 'node:child_process';
import { config } from './config.js';

const INSTRUCTIONS = `Você é um brasileiro com sotaque ${config.accent} e fala português do Brasil como língua materna. Pronúncia 100% brasileira nativa, nunca sotaque estrangeiro nem de Portugal. Animado e com energia, tom de parceiro de trabalho empolgado com o projeto, ritmo ágil, sorriso na voz, direto, sem soar como locutor.`;

let openaiBroken = false;
let current: ReturnType<typeof spawn> | null = null;
let chain: Promise<void> = Promise.resolve();
let speakingCount = 0;
/** Bumped by stopSpeaking; queued sentences from an older generation are skipped. */
let generation = 0;
let lastSpokeAt = 0;
const cache = new Map<string, Buffer>();
/** Aborted by stopSpeaking so queued sentences stop downloading (and being billed). */
let aborter = new AbortController();

export function lastSpeechEndedAt(): number {
  return speakingCount > 0 ? Date.now() : lastSpokeAt;
}

/**
 * True while audio is playing and for a tail after it, so the mic ignores the echo. Bluetooth
 * and car audio lag behind the player, hence the generous default.
 */
export function isSpeaking(): boolean {
  return speakingCount > 0 || Date.now() - lastSpokeAt < config.echoTailMs;
}

export function voiceProvider(): 'elevenlabs' | 'openai' | 'mac' {
  if (config.elevenKey && config.elevenVoice) return 'elevenlabs';
  return config.openaiKey ? 'openai' : 'mac';
}

function requestSpeech(text: string, signal: AbortSignal = AbortSignal.timeout(20000)): Promise<Response> {
  if (voiceProvider() === 'elevenlabs') {
    return fetch(`https://api.elevenlabs.io/v1/text-to-speech/${config.elevenVoice}/stream?output_format=mp3_44100_128`, {
      method: 'POST',
      headers: { 'xi-api-key': config.elevenKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, model_id: 'eleven_flash_v2_5', language_code: 'pt' }),
      signal,
    });
  }
  return fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.openaiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'gpt-4o-mini-tts', voice: config.openaiVoice, input: text, instructions: INSTRUCTIONS, response_format: 'mp3' }),
    signal,
  });
}

function sayOnMac(text: string): Promise<void> {
  return new Promise((resolve) => {
    current = spawn('say', ['-v', config.macVoice, '-r', String(Math.round(195 * config.speed)), text], { stdio: 'ignore' });
    current.on('exit', () => {
      current = null;
      resolve();
    });
  });
}

/** Plays mp3 bytes as they arrive, so speech starts before the download ends. */
async function playStream(chunks: AsyncIterable<Uint8Array> | Buffer): Promise<void> {
  const tempo = config.speed === 1 ? [] : ['-af', `atempo=${config.speed}`];
  const player = spawn('ffmpeg', ['-loglevel', 'error', '-i', 'pipe:0', ...tempo, '-f', 'audiotoolbox', '-'], { stdio: ['pipe', 'ignore', 'ignore'] });
  current = player;
  const done = new Promise<void>((resolve) => player.on('exit', () => resolve()));
  player.stdin.on('error', () => {});
  if (Buffer.isBuffer(chunks)) player.stdin.end(chunks);
  else {
    for await (const chunk of chunks) {
      if (player.exitCode !== null) break;
      player.stdin.write(chunk);
    }
    player.stdin.end();
  }
  await done;
  current = null;
}

/** Fetches common short phrases at startup so they play instantly. Also warms the connection. */
export async function preload(texts: string[]): Promise<void> {
  if (voiceProvider() === 'mac') return;
  await Promise.all(
    texts.map(async (t) => {
      try {
        const res = await requestSpeech(t);
        if (res.ok) cache.set(t, Buffer.from(await res.arrayBuffer()));
        else if (res.status === 401 || res.status === 403) openaiBroken = true;
      } catch {
        /* the mac voice still works */
      }
    }),
  );
}

function clean(text: string): string {
  return text
    .replace(/[`*_#>]/g, '')
    .replace(/\p{Extended_Pictographic}/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Queues a sentence. The audio request starts right away so the next sentence downloads
 * while the current one plays; playback stays in order and never overlaps.
 */
export function speak(raw: string): Promise<void> {
  const text = clean(raw);
  if (!text) return chain;
  speakingCount++;
  const cached = cache.get(text);
  const pending =
    !cached && voiceProvider() !== 'mac' && !openaiBroken
      ? requestSpeech(text, AbortSignal.any([aborter.signal, AbortSignal.timeout(20000)])).catch((err: Error) => err)
      : null;
  const myGeneration = generation;
  chain = chain.then(async () => {
    try {
      if (myGeneration !== generation) return;
      if (cached) return await playStream(cached);
      if (pending) {
        const res = await pending;
        if (myGeneration !== generation) return;
        if (res instanceof Response && res.ok && res.body) return await playStream(res.body as AsyncIterable<Uint8Array>);
        if (res instanceof Response && (res.status === 401 || res.status === 403)) openaiBroken = true;
        console.error(`  (voz ${voiceProvider()} falhou, usando a do Mac: ${res instanceof Response ? res.status : res.message})`);
      }
      await sayOnMac(text);
    } catch (err) {
      if (myGeneration === generation) console.error(`  (erro ao tocar a voz: ${(err as Error).message})`);
    } finally {
      speakingCount--;
      lastSpokeAt = Date.now();
    }
  });
  return chain;
}

/** Cuts the sentence being played and drops every sentence still queued. */
export function stopSpeaking(): void {
  generation++;
  aborter.abort();
  aborter = new AbortController();
  current?.kill();
}
