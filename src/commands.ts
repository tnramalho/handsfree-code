/** Spoken command words, in Portuguese and English. Matched against what follows the name. */
export const ARE_YOU_TALKING_TO_ME = /t[áa] falando comigo/i;
/** Only a stop word right after the name stops: "James, para". "Roda para mim" is not a stop. */
export const isStop = (text: string) => /^(para|pare|parar|cancela|cancelar|chega|espera|stop|cancel|wait)([^\p{L}]|$)/iu.test(text.trim());
const YES_WORDS = new Set(['sim', 'confirma', 'confirmo', 'confirmado', 'confirmar', 'pode', 'yes', 'confirm', 'confirmed']);
const YES_CORE = new Set(['sim', 'confirma', 'confirmo', 'confirmado', 'confirmar', 'yes', 'confirm', 'confirmed']);

/**
 * A spoken "yes" to a heavy action: the whole phrase must be confirmation words, with at least
 * one real one. "pode sim" and "sim, confirma" pass; "pode parar", "faz outra coisa" and "vai
 * devagar" do not.
 */
export function isYes(text: string): boolean {
  const words = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').split(/[^a-z]+/).filter(Boolean);
  return words.length > 0 && words.length <= 4 && words.every((w) => YES_WORDS.has(w)) && words.some((w) => YES_CORE.has(w));
}
export const NO = /^(n[aã]o|nunca|cancela|para|pare|espera|deixa|no|don'?t|cancel|stop|wait)([^\p{L}]|$)/iu;
export const QUIT_WORDS = /^(tchau|encerra|encerrar|desliga|sair|bye|goodbye|quit|exit)[.!]?$/i;
export const WORKTREE_CMD = /\b(abre|abrir|cria|criar|muda|mudar|vai|ir|open|switch|create|go)\b.*\bworktree\b\s+(?:da\s+|do\s+|de\s+|pra\s+|for\s+|to\s+|of\s+)?(?:the\s+)?(?:branch\s+)?([\w./-]+)/i;
