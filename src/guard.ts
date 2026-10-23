import os from 'node:os';
import path from 'node:path';

/**
 * Spots heavy actions so the assistant asks for a spoken confirmation first. This is a guard
 * against accidents, not a security boundary: it works on patterns, exactly like the rest of
 * Claude Code with permissions skipped.
 */
const HEAVY_BASH: Array<[RegExp, string]> = [
  [/\bgit\b[^;&|\n]*\bpush\b/, 'enviar commits pro repositório remoto (git push)'],
  [/\bgh\b[^;&|\n]*\b(pr\s+(create|merge)|release|api\b[^;&|\n]*-X\s*(POST|PUT|PATCH|DELETE))/i, 'mexer no GitHub (PR, release ou API)'],
  [/\b(npm|pnpm|yarn|bun)\s+(publish|run\s+(deploy|release|publish))\b/, 'publicar ou fazer deploy'],
  [/\bmake\s+(deploy|release|publish)\b/, 'fazer deploy'],
  [/\b(vercel|netlify|fly|flyctl|railway|wrangler|firebase|heroku)\b/, 'usar uma ferramenta de deploy'],
  [/(^|[\s/])deploy[\w-]*\.sh\b/, 'rodar script de deploy'],
  [/\b(ssh|scp|sftp)\b|\brsync\b[^;&|\n]*:/, 'acessar um servidor remoto'],
  [/\bdocker\b[^;&|\n]*\b(push|-H|--host|context\s+use)\b/, 'mexer em docker remoto'],
  [/\bgit\s+(reset\s+--hard|clean\s+-[a-z]*f|branch\s+-D|checkout\s+--\s|restore\s)/, 'descartar trabalho do git'],
  [/\bgit\b[^;&|\n]*\bpush\b[^;&|\n]*(--force|-f\b|--delete)/, 'forçar ou apagar no remoto'],
  [/\bsudo\b/, 'rodar como administrador (sudo)'],
  [/\bfind\b[^;&|\n]*-delete\b/, 'apagar arquivos com find'],
  [/\bcurl\b[^;&|\n]*(\s-d\b|--data|-F\b|--form|-T\b|--upload-file|-X\s*(POST|PUT))/, 'enviar dados pra internet'],
];

function inside(root: string, target: string): boolean {
  const rel = path.relative(root, target);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

function expandHome(p: string): string {
  return p.replace(/^~(?=\/|$)/, os.homedir()).replace(/^\$\{?HOME\}?(?=\/|$)/, os.homedir());
}

/**
 * rm -r / mv whose target leaves the project folder. Follows `cd` between chained commands, so
 * `cd .. && rm -rf proj` is caught, and strips quotes, so `"$HOME"/Documents` is too.
 */
function destructiveOutside(command: string, root: string): boolean {
  let dir = root;
  for (const segment of command.split(/&&|\|\||;|\n|\|/)) {
    const words = segment.trim().split(/\s+/).map((a) => a.replace(/["']/g, '')).filter(Boolean);
    if (words[0] === 'cd') {
      dir = path.resolve(dir, expandHome(words[1] ?? os.homedir()));
      continue;
    }
    const at = words.findIndex((w) => w === 'rm' || w === 'mv');
    if (at < 0) continue;
    const args = words.slice(at + 1);
    const recursive = words[at] === 'mv' || args.some((a) => /^-[a-zA-Z]*[rR]/.test(a) || a === '--recursive');
    if (!recursive) continue;
    for (const a of args) {
      if (a.startsWith('-')) continue;
      if (a === '*' || a === '.' || a === './' || a === '/') return true;
      const target = path.resolve(dir, expandHome(a));
      // Deleting or moving the project folder itself counts as leaving it.
      if (target === root || !inside(root, target)) return true;
    }
  }
  return false;
}

/** Returns what the action would do, in plain words, when it needs a spoken yes. */
export function heavyAction(tool: string, input: Record<string, unknown>, root: string): string | null {
  if (tool === 'Bash') {
    const command = String(input.command ?? '');
    for (const [re, label] of HEAVY_BASH) if (re.test(command)) return label;
    if (destructiveOutside(command, root)) return 'apagar ou mover arquivos fora da pasta do projeto';
    return null;
  }
  if (tool === 'Write' || tool === 'Edit' || tool === 'MultiEdit' || tool === 'NotebookEdit') {
    const file = String(input.file_path ?? input.notebook_path ?? '');
    if (!file) return null;
    const abs = path.resolve(root, expandHome(file));
    if (!inside(root, abs)) return `alterar um arquivo fora do projeto (${abs.replace(os.homedir(), '~')})`;
    const rel = path.relative(root, abs);
    if (/^\.git\//.test(rel)) return 'alterar arquivos internos do git';
    if (/^\.claude\/settings/.test(rel)) return 'alterar as configurações do Claude deste projeto';
  }
  return null;
}
