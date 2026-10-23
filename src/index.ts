#!/usr/bin/env node
import { listSessions } from '@anthropic-ai/claude-agent-sdk';
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';
import { pickDevice, startListening } from './mic.js';
import { CONFIRM_TIMEOUT_S, ClaudeSession } from './session.js';
import { stopStt, transcribe, warmUpLocal } from './stt.js';
import { isSpeaking, lastSpeechEndedAt, preload, speak, stopSpeaking, voiceProvider } from './tts.js';
import { ARE_YOU_TALKING_TO_ME, NO, QUIT_WORDS, WORKTREE_CMD, isStop, isYes } from './commands.js';
import { forVoice } from './voice-text.js';
import { wakeMatcher } from './wake.js';
import { currentBranch, ensureWorktree } from './worktree.js';

const HELP = `handsfree: talk to Claude Code by voice (Portuguese first)

  handsfree [options]        (also available as: voz)

  --name <name>          wake word to call the assistant (default: James)    [--nome]
  -w, --worktree <b>     create/use a git worktree for branch <b> and work there
  --handoff <file>       read this file as context before starting
  --continue             continue the most recent Claude Code session here   [--continuar]
  --session <id>         continue a specific Claude Code session             [--sessao]
  --mic                  microphone level meter
  -h, --help             this help

  Config: ~/.config/handsfree-code/config.env  (see README)
`;

/** After the assistant finishes a turn, the user may answer without saying the name for this long. */
const FOLLOW_UP_MS = 20000;

const ACKS = ['Beleza.', 'Certo, vou ver.', 'Ok, tô nisso.', 'Entendi.'];
const LISTENING = 'Opa, diga.';
const UNNAMED = '(fala sem me chamar pelo nome)';

function voiceRules(name: string): string {
  return `
Você se chama ${name}, mas nunca diga o próprio nome em voz alta (o usuário usa o nome pra te interromper). Você está sendo usado POR VOZ, com o usuário dirigindo. Ele não lê a tela: tudo o que você escrever em texto vai ser lido em voz alta.
- Fale em português do Brasil, como um colega no telefone. Direto e objetivo: no máximo duas frases curtas por mensagem. Não comece com saudação nem com o nome do projeto.
- Nunca leia código, caminhos longos, hashes, tabelas ou listas. Diga o que fez em palavras simples ("mudei a versão do Node nas duas imagens").
- Antes de uma tarefa longa, diga em uma frase o que vai fazer. Durante, avise só os marcos ("testes rodando", "dois testes falharam, corrigindo"). Ao terminar, diga o resultado e pergunte o próximo passo.
- Se faltar informação para decidir, faça UMA pergunta curta e pare.
- O microfone pega o carro inteiro. Mensagens marcadas com "${UNNAMED}" podem ser o usuário falando com outra pessoa. Se ela não for claramente uma resposta à sua última pergunta ou um pedido pra você, responda só "Tá falando comigo?" e não faça mais nada.
- Ações pesadas (git push, PR, deploy, publicar, sudo, servidor remoto, apagar ou alterar coisas fora do projeto) pedem confirmação falada antes de rodar; o sistema pergunta sozinho. Se o usuário não confirmar, não tente por outro caminho.
- Pode criar branch, commitar localmente e criar worktree sem perguntar.
`.trim();
}

interface Args {
  name: string;
  worktree?: string;
  handoff?: string;
  resume?: string;
  continueLast: boolean;
  micTest: boolean;
}

function parseArgs(argv: string[]): Args {
  const value = (...flags: string[]) => {
    const i = argv.findIndex((a) => flags.includes(a));
    if (i < 0) return undefined;
    const v = argv[i + 1];
    if (!v || v.startsWith('-')) throw new Error(`${flags[0]} precisa de um valor`);
    return v;
  };
  if (argv.includes('-h') || argv.includes('--help')) {
    console.log(HELP);
    process.exit(0);
  }
  return {
    name: value('--name', '--nome') ?? (config.name || 'James'),
    worktree: value('-w', '--worktree'),
    handoff: value('--handoff'),
    resume: value('--session', '--sessao'),
    continueLast: argv.includes('--continue') || argv.includes('--continuar'),
    micTest: argv.includes('--mic'),
  };
}

function slugBranch(spoken: string): string {
  return spoken.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9./-]+/g, '-').replace(/^-|-$/g, '');
}

let cwd = process.cwd();
let assistantName = 'James';
let session: ClaudeSession;
let rules = '';
const queue: string[] = [];

/** Set while a "para" is on its way; cleared by the turn ending or after a few seconds. */
let interrupting = false;
let interruptTimer: NodeJS.Timeout | undefined;

/**
 * The follow-up window opens only when a turn the user asked for by name ends, or after
 * "Opa, diga". It is not reopened by acks, "Parei." or "Tá falando comigo?", so passenger
 * chatter cannot keep it alive.
 */
let followUpArmed = false;
let lastRequestNamed = false;
let lastText = '';

interface PendingConfirm {
  resolve: (yes: boolean) => void;
  timer: NodeJS.Timeout;
}
let pendingConfirm: PendingConfirm | null = null;
/** Claude may request several heavy actions at once; they are asked one at a time. */
let confirmChain: Promise<unknown> = Promise.resolve();

/**
 * Set after "Opa, diga.": the next phrase counts as addressed even without the name, also while
 * Claude is working (it goes to the queue then).
 */
let listeningArmed = false;
const LISTENING_MS = 10000;

function settleConfirm(yes: boolean): void {
  if (!pendingConfirm) return;
  clearTimeout(pendingConfirm.timer);
  const { resolve } = pendingConfirm;
  pendingConfirm = null;
  resolve(yes);
}

// The question never contains the name: its own voice coming back through the speaker must not
// be able to answer it.
const CONFIRM_HOW = 'Pra seguir, me chame e diga confirma. Pra cancelar, me chame e diga não.';

function askOneConfirmation(what: string): Promise<boolean> {
  stopSpeaking();
  void speak(`Antes de seguir: vou ${what}. ${CONFIRM_HOW}`);
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      pendingConfirm = null;
      void speak('Sem resposta, não fiz.');
      resolve(false);
    }, CONFIRM_TIMEOUT_S * 1000);
    pendingConfirm = { resolve, timer };
  });
}

function askConfirmation(what: string): Promise<boolean> {
  const answer = confirmChain.then(() => askOneConfirmation(what));
  confirmChain = answer.catch(() => undefined);
  return answer;
}

function openSession(resume?: string): void {
  session = new ClaudeSession(
    cwd,
    rules,
    {
      onText: (text) => {
        console.log(`🤖 ${text}`);
        lastText = text;
        void speak(forVoice(text));
      },
      onTool: (line) => console.log(`  · ${line}`),
      onIdle: (ok) => {
        clearTimeout(interruptTimer);
        if (interrupting) {
          interrupting = false;
          void speak('Parei.');
        } else if (!ok) void speak('Deu um erro do meu lado e parei. Quer que eu tente de novo?');
        followUpArmed = ok && lastRequestNamed && !ARE_YOU_TALKING_TO_ME.test(lastText);
        const next = queue.shift();
        if (next) {
          lastRequestNamed = true;
          session.send(next);
        }
      },
      confirm: askConfirmation,
      onCrash: (message) => {
        console.error(`  ⚠️  Claude caiu: ${message}`);
        settleConfirm(false);
        queue.length = 0;
        void speak(session.dead ? 'O Claude parou de funcionar. Olha o terminal quando puder.' : 'O Claude caiu, tô reabrindo a conversa.');
      },
    },
    resume,
  );
  session.start();
}

function switchWorktree(branchSpoken: string): void {
  const branch = slugBranch(branchSpoken);
  try {
    cwd = ensureWorktree(cwd, branch);
    session.close();
    openSession();
    console.log(`📂 ${cwd} (${currentBranch(cwd)})`);
    void speak(`Pronto, estou no worktree ${branch}, numa conversa nova.`);
  } catch (err) {
    console.error(`  erro no worktree: ${(err as Error).message}`);
    void speak('Não consegui criar esse worktree. Olha o terminal quando puder.');
  }
}

function shutdown(code = 0): never {
  settleConfirm(false);
  session?.close();
  stopSpeaking();
  stopStt();
  spawnSync('pkill', ['-P', String(process.pid)]);
  process.exit(code);
}

function beep(): void {
  spawn('afplay', ['-v', '0.4', '/System/Library/Sounds/Tink.aiff'], { stdio: 'ignore' });
}

function inFollowUpWindow(): boolean {
  if (!followUpArmed || session.busy || isSpeaking()) return false;
  if (Date.now() - lastSpeechEndedAt() < FOLLOW_UP_MS) return true;
  followUpArmed = false;
  return false;
}

function listening(): boolean {
  if (!listeningArmed || isSpeaking()) return false;
  if (Date.now() - lastSpeechEndedAt() < LISTENING_MS) return true;
  listeningArmed = false;
  return false;
}

/** After a barge-in stop, the rest of "James, para" arrives as a normal phrase: ignore it. */
let ignoreUtterancesUntil = 0;

function stopEverything(): void {
  stopSpeaking();
  queue.length = 0;
  if (session.busy) {
    interrupting = true;
    clearTimeout(interruptTimer);
    interruptTimer = setTimeout(() => (interrupting = false), 10000);
    void session.interrupt();
  } else void speak('Tô parado.');
}

function makeHandler(name: string) {
  const addressedTo = wakeMatcher(name, config.nameSpellings);
  // During a barge-in the window also holds the assistant's own voice: keep only what follows the name.
  const addressedToAfter = wakeMatcher(name, config.nameSpellings, { afterOnly: true });
  let bargeBusy = false;

  /**
   * A barge-in only ever cuts the speech. It stops the task on "name + para"; anything else gets
   * "Opa, diga." and the request is heard in full afterwards. It never answers a confirmation:
   * that window may hold the assistant's own question coming back through the speaker.
   */
  async function onBargeWindow(pcm: Buffer): Promise<void> {
    if (bargeBusy || !isSpeaking()) return;
    bargeBusy = true;
    try {
      const heard = await transcribe(pcm, { quick: true });
      if (!heard || !isSpeaking()) return;
      const address = addressedToAfter(heard);
      if (!address.addressed) return;
      console.log(`✋ interrompido: ${heard}`);
      stopSpeaking();
      if (pendingConfirm) return void speak(CONFIRM_HOW);
      beep();
      if (isStop(address.rest)) {
        ignoreUtterancesUntil = Date.now() + 2500;
        return stopEverything();
      }
      listeningArmed = true;
      void speak(LISTENING);
    } catch (err) {
      console.error(`  erro na interrupção: ${(err as Error).message}`);
    } finally {
      bargeBusy = false;
    }
  }

  async function onUtterance(pcm: Buffer): Promise<void> {
    try {
      const heard = await transcribe(pcm);
      if (!heard) return;
      const { addressed, rest } = addressedTo(heard);
      if (Date.now() < ignoreUtterancesUntil && !addressed) return;
      if (addressed) return await act(rest, true, heard);
      if (listening()) {
        listeningArmed = false;
        return await act(heard, true, heard);
      }
      if (inFollowUpWindow()) return await act(heard, false, heard);
      console.log(`  (ignorado, não me chamou) ${heard}`);
    } catch (err) {
      console.error(`  erro ao ouvir: ${(err as Error).message}`);
    }
  }

  async function act(text: string, addressed: boolean, heard: string): Promise<void> {
    console.log(`🗣  ${heard}`);
    if (addressed) beep();

    if (pendingConfirm) {
      if (!addressed) return;
      if (QUIT_WORDS.test(text)) {
        await speak('Fechado. Até mais.');
        shutdown();
      }
      if (isStop(text)) {
        settleConfirm(false);
        return stopEverything();
      }
      if (NO.test(text)) {
        settleConfirm(false);
        return void speak('Ok, não faço.');
      }
      if (isYes(text)) return settleConfirm(true);
      return void speak(`Não entendi. ${CONFIRM_HOW}`);
    }
    if (addressed) {
      if (!text) {
        listeningArmed = true;
        return void speak(LISTENING);
      }
      if (QUIT_WORDS.test(text)) {
        await speak('Fechado. Até mais.');
        shutdown();
      }
      if (isStop(text)) return stopEverything();
      const wt = text.match(WORKTREE_CMD);
      if (wt && !session.busy) return switchWorktree(wt[2]);
    }
    if (session.dead) return void speak('O Claude parou de funcionar. Olha o terminal quando puder.');

    followUpArmed = false;
    const message = addressed ? text : `${UNNAMED} ${text}`;
    if (session.busy) {
      queue.push(message);
      void speak('Anotado, faço logo depois.');
      return;
    }
    console.log('🤔 Claude trabalhando...');
    if (addressed) void speak(ACKS[Math.floor(Math.random() * ACKS.length)]);
    lastRequestNamed = addressed;
    session.send(message);
  }

  return { onUtterance, onBargeWindow };
}

/** `voz --mic`: live level meter to check the microphone and the speech threshold. */
function micTest(index: number): void {
  console.log('Fale algo. A barra tem que passar do | quando você fala. Ctrl+C sai.\n');
  let last = 0;
  startListening(index, () => false, (pcm) => console.log(`\n✅ frase detectada (${(pcm.length / 32000).toFixed(1)}s)`), {
    onSpeechStart: beep,
    onLevel: (level, threshold) => {
      if (Date.now() - last < 100) return;
      last = Date.now();
      const scale = (v: number) => Math.min(50, Math.round(Math.log10(Math.max(v, 1)) * 12));
      const bar = '█'.repeat(scale(level)).padEnd(50, ' ').split('');
      bar[scale(threshold)] = '|';
      process.stdout.write(`\r${bar.join('')} ${String(Math.round(level)).padStart(5)}`);
    },
  });
  process.on('SIGINT', () => shutdown());
}

async function resolveResume(args: Args): Promise<string | undefined> {
  if (args.resume) return args.resume;
  if (!args.continueLast) return undefined;
  const [last] = await listSessions({ dir: cwd, limit: 1 });
  if (!last) throw new Error('Não achei sessão anterior do Claude Code nesta pasta.');
  console.log(`↩️  continuando: ${last.customTitle || last.summary || last.firstPrompt || last.sessionId}`);
  return last.sessionId;
}

function firstMessage(args: Args, resumed: boolean): string | undefined {
  if (args.handoff) {
    const file = path.resolve(args.handoff);
    const content = fs.readFileSync(file, 'utf8');
    return `Este é o handoff do trabalho em andamento (arquivo ${path.basename(file)}):\n\n${content}\n\nLeia, não execute nada ainda, e me diga em uma frase onde a gente está e qual o próximo passo.`;
  }
  if (resumed) return 'Estou continuando esta sessão por voz. Não execute nada: me diga em uma frase onde a gente parou e qual o próximo passo.';
  return undefined;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const mic = pickDevice(config.mic);
  if (args.micTest) {
    console.log(`🎙  ${mic.name}`);
    return micTest(mic.index);
  }
  if (args.worktree) cwd = ensureWorktree(cwd, args.worktree);
  assistantName = args.name;
  rules = voiceRules(args.name);
  const resume = await resolveResume(args);
  const opening = firstMessage(args, Boolean(resume));
  warmUpLocal(args.name);
  openSession(resume);

  console.log(`📂 ${cwd} (${currentBranch(cwd)})`);
  console.log(`🎙  ${mic.name}`);
  const provider = voiceProvider();
  console.log(`🔊 voz ${provider === 'elevenlabs' ? 'ElevenLabs' : provider === 'openai' ? 'OpenAI (' + config.openaiVoice + ')' : 'do Mac (' + config.macVoice + ')'}${provider === 'mac' ? '' : ', reserva: Mac'}`);
  console.log(`📝 transcrição ${config.openaiKey ? 'OpenAI, reserva local' : 'local (' + config.sttModel + ')'}`);
  console.log(`Chame "${args.name}" pra falar com ele. "${args.name}, para" interrompe, "${args.name}, tchau" encerra. Ctrl+C sai.\n`);

  spawn('caffeinate', ['-dis', '-w', String(process.pid)], { stdio: 'ignore', detached: true }).unref();

  // macOS hands a mic without permission back as pure silence, never as an error.
  let peak = 0;
  setTimeout(() => {
    if (peak > 0) return;
    const msg = 'O microfone está chegando mudo. Dê permissão de microfone para este terminal em Ajustes, Privacidade e Segurança, Microfone, e abra o terminal de novo.';
    console.error(`\n⚠️  ${msg}`);
    void speak(msg);
  }, 8000);

  const { onUtterance, onBargeWindow } = makeHandler(args.name);
  const ff = startListening(mic.index, isSpeaking, (pcm) => void onUtterance(pcm), {
    onBargeWindow: (pcm) => void onBargeWindow(pcm),
    onLevel: (level) => {
      if (level > peak) peak = level;
    },
  });
  ff.on('exit', (code) => {
    console.error(`Microfone parou (código ${code}). Confira a permissão de microfone do terminal.`);
    shutdown(1);
  });
  process.on('SIGINT', () => shutdown());

  await preload([...ACKS, LISTENING, 'Anotado, faço logo depois.', 'Parei.', 'Tô parado.', 'Ok, não faço.']);
  if (opening) {
    console.log('🤔 lendo o contexto...');
    lastRequestNamed = true;
    session.send(opening);
  } else {
    void speak(`Na escuta. Estamos em ${path.basename(cwd)}, na branch ${currentBranch(cwd)}.`);
  }
}

// A stray rejection must not end a session on the road; it is logged and the app keeps going.
process.on('unhandledRejection', (err) => console.error(`  erro inesperado: ${(err as Error)?.message ?? err}`));
process.on('uncaughtException', (err) => console.error(`  erro inesperado: ${err.message}`));

main().catch((err: Error) => {
  console.error(`erro: ${err.message}`);
  process.exit(1);
});
