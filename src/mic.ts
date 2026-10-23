import { execFileSync, spawn, spawnSync, type ChildProcess } from 'node:child_process';

const SAMPLE_RATE = 16000;
const FRAME_MS = 30;
const FRAME_BYTES = (SAMPLE_RATE * 2 * FRAME_MS) / 1000;
const START_MS = 150;
const END_SILENCE_MS = 800;
const MAX_UTTERANCE_MS = 60000;
const BARGE_WINDOW_MS = 2400;
const BARGE_STEP_MS = 1200;
const IGNORED_DEVICES =/zoom|teams|blackhole|loopback|soundflower/i;

function listAudioDevices(): string[] {
  const probe = spawnSync('ffmpeg', ['-version'], { stdio: 'ignore' });
  if (probe.error) throw new Error('ffmpeg não encontrado. Instale com: brew install ffmpeg');
  let out = '';
  try {
    execFileSync('ffmpeg', ['-hide_banner', '-f', 'avfoundation', '-list_devices', 'true', '-i', ''], {
      stdio: ['ignore', 'ignore', 'pipe'],
    });
  } catch (err) {
    out = String((err as { stderr?: Buffer }).stderr ?? '');
  }
  const section = out.split('AVFoundation audio devices:')[1] ?? '';
  return [...section.matchAll(/\[(\d+)\] (.+)/g)].map((m) => m[2].trim());
}

export function pickDevice(wanted: string): { index: number; name: string } {
  const devices = listAudioDevices();
  if (devices.length === 0) throw new Error('Nenhum microfone encontrado (o terminal tem permissão de microfone?)');
  const byName = wanted ? devices.findIndex((d) => d.toLowerCase().includes(wanted.toLowerCase())) : -1;
  if (wanted && byName < 0) throw new Error(`Microfone "${wanted}" não encontrado. Disponíveis: ${devices.join(', ')}`);
  const index = byName >= 0 ? byName : Math.max(0, devices.findIndex((d) => !IGNORED_DEVICES.test(d)));
  return { index, name: devices[index] };
}

function rms(frame: Buffer): number {
  let sum = 0;
  for (let i = 0; i < frame.length; i += 2) {
    const s = frame.readInt16LE(i);
    sum += s * s;
  }
  return Math.sqrt(sum / (frame.length / 2));
}

export function wavFromPcm(pcm: Buffer): Buffer {
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write('WAVEfmt ', 8);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(SAMPLE_RATE, 24);
  header.writeUInt32LE(SAMPLE_RATE * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

/**
 * Listens continuously and calls onUtterance with the PCM of each spoken phrase.
 * Frames are dropped while `muted()` is true so the assistant never hears itself.
 */
export interface ListenHooks {
  onSpeechStart?: () => void;
  /**
   * While muted (the assistant is talking), the last BARGE_WINDOW_MS of audio is handed over
   * every BARGE_STEP_MS, so the caller can look for the assistant's name and cut the speech.
   * Windows overlap so a phrase is never split in half.
   */
  onBargeWindow?: (pcm: Buffer) => void;
  /** Called every frame with the level and the current speech threshold. */
  onLevel?: (level: number, threshold: number) => void;
}

export function startListening(
  deviceIndex: number,
  muted: () => boolean,
  onUtterance: (pcm: Buffer) => void,
  hooks: ListenHooks = {},
): ChildProcess {
  const ff = spawn(
    'ffmpeg',
    ['-hide_banner', '-loglevel', 'error', '-f', 'avfoundation', '-i', `:${deviceIndex}`, '-ac', '1', '-ar', String(SAMPLE_RATE), '-f', 's16le', '-'],
    { stdio: ['ignore', 'pipe', 'inherit'] },
  );

  let pending = Buffer.alloc(0);
  let noiseFloor = 300;
  let speaking = false;
  let loudMs = 0;
  let quietMs = 0;
  let chunks: Buffer[] = [];
  let preRoll: Buffer[] = [];
  let barge: Buffer[] = [];
  let bargeLoud: boolean[] = [];
  let sinceBarge = 0;

  const reset = () => {
    speaking = false;
    loudMs = 0;
    quietMs = 0;
    chunks = [];
  };

  ff.stdout!.on('data', (data: Buffer) => {
    pending = Buffer.concat([pending, data]);
    while (pending.length >= FRAME_BYTES) {
      const frame = pending.subarray(0, FRAME_BYTES);
      pending = pending.subarray(FRAME_BYTES);
      if (muted()) {
        reset();
        preRoll = [];
        if (hooks.onBargeWindow) {
          barge.push(Buffer.from(frame));
          bargeLoud.push(rms(frame) > Math.max(250, noiseFloor * 3));
          if (barge.length > BARGE_WINDOW_MS / FRAME_MS) {
            barge.shift();
            bargeLoud.shift();
          }
          sinceBarge += FRAME_MS;
          if (sinceBarge >= BARGE_STEP_MS && barge.length >= BARGE_WINDOW_MS / FRAME_MS) {
            sinceBarge = 0;
            if (bargeLoud.filter(Boolean).length >= 10) hooks.onBargeWindow(Buffer.concat(barge));
          }
        }
        continue;
      }
      barge = [];
      bargeLoud = [];
      sinceBarge = 0;
      const level = rms(frame);
      const threshold = Math.max(250, noiseFloor * 3);
      const loud = level > threshold;
      hooks.onLevel?.(level, threshold);
      if (!speaking) {
        noiseFloor = noiseFloor * 0.98 + Math.min(level, threshold) * 0.02;
        preRoll.push(Buffer.from(frame));
        if (preRoll.length > 10) preRoll.shift();
        loudMs = loud ? loudMs + FRAME_MS : 0;
        if (loudMs >= START_MS) {
          speaking = true;
          chunks = [...preRoll];
          preRoll = [];
          hooks.onSpeechStart?.();
        }
        continue;
      }
      chunks.push(Buffer.from(frame));
      quietMs = loud ? 0 : quietMs + FRAME_MS;
      const totalMs = chunks.length * FRAME_MS;
      if (quietMs >= END_SILENCE_MS || totalMs >= MAX_UTTERANCE_MS) {
        const pcm = Buffer.concat(chunks);
        reset();
        onUtterance(pcm);
      }
    }
  });
  return ff;
}
