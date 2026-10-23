import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/** Where the local transcription model and its Python venv live. */
export const DATA_DIR = path.join(os.homedir(), '.handsfree-code');

/** `~/.config/handsfree-code/config.env`, or `$XDG_CONFIG_HOME/handsfree-code/config.env`. */
export const CONFIG_FILE = path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'), 'handsfree-code', 'config.env');

function readEnvFile(file: string): Record<string, string> {
  if (!fs.existsSync(file)) return {};
  const out: Record<string, string> = {};
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*(#.*)?$/);
    if (m) out[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
  return out;
}

const file = readEnvFile(CONFIG_FILE);

/**
 * Reads `HANDSFREE_<KEY>` from the environment or the config file. `aliases` are older names
 * that keep working.
 */
function get(key: string, ...aliases: string[]): string {
  for (const k of [key, ...aliases]) {
    const v = process.env[k] || file[k];
    if (v) return v;
  }
  return '';
}

const num = (v: string, fallback: number) => (v && Number.isFinite(Number(v)) ? Number(v) : fallback);

export const config = {
  openaiKey: get('OPENAI_API_KEY'),
  elevenKey: get('ELEVENLABS_API_KEY'),
  elevenVoice: get('HANDSFREE_ELEVENLABS_VOICE', 'VOZ_ELEVEN_VOICE'),
  mic: get('HANDSFREE_MIC', 'VOZ_MIC'),
  name: get('HANDSFREE_NAME', 'VOZ_NOME'),
  /** Extra spellings of the name the transcription produces, comma separated. */
  nameSpellings: get('HANDSFREE_NAME_SPELLINGS', 'VOZ_NOME_VARIANTES').split(',').map((s) => s.trim()).filter(Boolean),
  openaiVoice: get('HANDSFREE_OPENAI_VOICE', 'VOZ_OPENAI_VOICE') || 'echo',
  /** How long after playback the mic keeps ignoring sound (speaker and Bluetooth lag). */
  echoTailMs: num(get('HANDSFREE_ECHO_TAIL_MS', 'VOZ_ECO_MS'), 1000),
  speed: Math.min(2, Math.max(0.5, num(get('HANDSFREE_SPEED', 'VOZ_VELOCIDADE'), 1.4))),
  accent: get('HANDSFREE_ACCENT', 'VOZ_SOTAQUE') || 'brasileiro neutro, sem nenhuma marca regional',
  macVoice: get('HANDSFREE_MAC_VOICE', 'VOZ_MAC_VOICE') || 'Eddy',
  sttModel: get('HANDSFREE_LOCAL_STT_MODEL', 'VOZ_STT_MODEL') || 'small',
  python: (get('HANDSFREE_PYTHON', 'VOZ_PYTHON') || path.join(DATA_DIR, 'venv', 'bin', 'python')).replace(/^~(?=\/|$)/, os.homedir()),
};
