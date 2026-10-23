/** How Portuguese speech-to-text tends to spell English names it hears. */
const KNOWN_SPELLINGS: Record<string, string[]> = {
  james: ['djeims', 'djeimes', 'djeimis', 'jeims', 'jeimes', 'jeimis', 'jemes', 'djemes', 'jâmes'],
};

const VOCATIVE = '(o|oh|ei|e ai|ai|oi|alo|fala|hey)';
const VOCATIVE_ONLY = new RegExp(`^${VOCATIVE}$`);
const VOCATIVE_LEAD = new RegExp(`^${VOCATIVE}[\\s,.!?]+`);

export function fold(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

export interface Address {
  addressed: boolean;
  /** The request with the name and the "ô/ei/oi" around it removed. */
  rest: string;
}

/** Builds a matcher for the assistant's name. `extra` adds spellings the user has seen. */
export function wakeMatcher(name: string, extra: string[] = [], opts: { afterOnly?: boolean } = {}): (text: string) => Address {
  const base = fold(name.trim());
  const spellings = [base, ...(KNOWN_SPELLINGS[base] ?? []), ...extra.map((e) => fold(e.trim()))].filter(Boolean).map(fold);
  const alt = [...new Set(spellings)].sort((a, b) => b.length - a.length).map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const re = new RegExp(`(^|[^\\p{L}])(${alt.join('|')})(?=$|[^\\p{L}])`, 'u');

  return (text: string) => {
    const folded = fold(text);
    const m = folded.match(re);
    if (!m || m.index === undefined) return { addressed: false, rest: text.trim() };
    const start = m.index + m[1].length;
    const end = start + m[2].length;
    // Folding keeps the length for Latin text, so the indexes map back onto the original.
    const before = text.slice(0, start).replace(/[\s,.!?;:-]+$/, '');
    const after = text.slice(end).replace(/^[\s,.!?;:-]+/, '');
    const keepBefore = !opts.afterOnly && before && !VOCATIVE_ONLY.test(fold(before).replace(/[\s,.!?;:-]+/g, ' ').trim());
    let rest = [keepBefore ? before : '', after].filter(Boolean).join(' ').trim();
    if (VOCATIVE_LEAD.test(fold(rest))) rest = rest.replace(/^\S+[\s,.!?]+/, '');
    if (!/[\p{L}\p{N}]/u.test(rest)) rest = '';
    return { addressed: true, rest };
  };
}
