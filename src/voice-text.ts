const MAX_CHARS = 320;

function shorten(text: string): string {
  return text.length <= MAX_CHARS ? text : text.slice(0, MAX_CHARS - 20).replace(/\s+\S*$/, '') + '...';
}

/**
 * Speaks at most two sentences; anything longer stays in the terminal. A closing question is
 * always kept, because the user cannot read the terminal and has to hear what is being asked.
 */
export function forVoice(text: string): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  const sentences = (flat.match(/[^.!?]+[.!?]+["')\]]*|[^.!?]+$/g) ?? [flat]).map((s) => s.trim()).filter(Boolean);
  if (sentences.length <= 2 && flat.length <= MAX_CHARS) return sentences.join(' ');
  const last = sentences[sentences.length - 1];
  const asks = last.endsWith('?') && sentences.length > 1;
  const head = shorten(sentences.slice(0, asks ? 1 : 2).join(' '));
  return asks ? `${head} ${shorten(last)}` : `${head} O resto tá no terminal.`;
}
