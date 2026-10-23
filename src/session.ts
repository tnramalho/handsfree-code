import { query, type HookCallback, type Query, type SDKUserMessage } from '@anthropic-ai/claude-agent-sdk';
import { heavyAction } from './guard.js';

/** How long Claude waits for the spoken "confirma" before giving up on a heavy action. */
export const CONFIRM_TIMEOUT_S = 90;

export interface SessionEvents {
  onText: (text: string) => void;
  onTool: (line: string) => void;
  onIdle: (ok: boolean) => void;
  /** Resolves true when the user confirmed out loud. */
  confirm: (what: string) => Promise<boolean>;
  /** The Claude process died; the session restarts on its own. */
  onCrash: (message: string) => void;
}

/**
 * One Claude Code process kept alive for the whole conversation: each spoken request is a new
 * user message on the same stream, so there is no process start or MCP loading per request.
 * If the process dies, it restarts on the same conversation.
 */
export class ClaudeSession {
  private q: Query | null = null;
  private wake: (() => void) | null = null;
  private inbox: string[] = [];
  private closed = false;
  private sessionId?: string;
  private forkOnStart: boolean;
  busy = false;

  constructor(
    private cwd: string,
    private rules: string,
    private events: SessionEvents,
    /** Existing Claude Code session to continue. It is forked, so the original stays untouched. */
    resume?: string,
  ) {
    this.sessionId = resume;
    this.forkOnStart = Boolean(resume);
  }

  private async *messages(): AsyncGenerator<SDKUserMessage> {
    while (!this.closed) {
      const text = this.inbox.shift();
      if (text === undefined) {
        await new Promise<void>((r) => (this.wake = r));
        continue;
      }
      yield { type: 'user', message: { role: 'user', content: text }, parent_tool_use_id: null, origin: { kind: 'human' } } as SDKUserMessage;
    }
  }

  private guard: HookCallback = async (input) => {
    if (input.hook_event_name !== 'PreToolUse') return { continue: true };
    const what = heavyAction(input.tool_name, (input.tool_input ?? {}) as Record<string, unknown>, this.cwd);
    if (!what) return { continue: true };
    this.events.onTool(`❓ pedindo confirmação: ${what}`);
    const yes = await this.events.confirm(what);
    this.events.onTool(yes ? '✅ confirmado' : '🚫 não confirmado');
    if (yes) return { hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'allow', permissionDecisionReason: 'Confirmado por voz.' } };
    return {
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: 'O usuário não confirmou essa ação por voz. Não tente de novo por outro caminho; siga com o resto ou pergunte o que ele prefere.',
      },
    };
  };

  start(): void {
    // Until the fork has produced its own id, a restart forks the original again instead of
    // writing into it.
    const resume = this.sessionId ? { resume: this.sessionId, forkSession: this.forkOnStart } : {};
    this.q = query({
      prompt: this.messages(),
      options: {
        cwd: this.cwd,
        ...resume,
        permissionMode: 'bypassPermissions',
        allowDangerouslySkipPermissions: true,
        systemPrompt: { type: 'preset', preset: 'claude_code', append: this.rules },
        // Project settings and CLAUDE.md only: the user's MCP servers took seconds to load and
        // are useless while driving.
        settingSources: ['project', 'local'],
        mcpServers: {},
        strictMcpConfig: true,
        hooks: { PreToolUse: [{ hooks: [this.guard], timeout: CONFIRM_TIMEOUT_S + 30 }] },
      },
    });
    void this.pump();
  }

  private describe(name: string, input: Record<string, unknown>): string {
    if (name === 'Bash') return `$ ${String(input.command ?? '').slice(0, 120)}`;
    const file = String(input.file_path ?? input.path ?? input.pattern ?? '');
    return `${name} ${file.replace(this.cwd + '/', '')}`.trim();
  }

  private async pump(): Promise<void> {
    let failure = 'o Claude parou de responder';
    try {
      for await (const msg of this.q!) {
        if ('session_id' in msg && msg.session_id && msg.session_id !== this.sessionId) {
          this.sessionId = msg.session_id;
          this.forkOnStart = false;
        }
        if (msg.type === 'assistant') {
          for (const block of msg.message.content) {
            if (block.type === 'text' && block.text.trim()) this.events.onText(block.text.trim());
            else if (block.type === 'tool_use') this.events.onTool(this.describe(block.name, block.input as Record<string, unknown>));
          }
        } else if (msg.type === 'result') {
          this.busy = false;
          this.events.onIdle(msg.subtype === 'success');
        }
      }
    } catch (err) {
      failure = (err as Error).message;
    }
    if (this.closed) return;
    // The stream ended or broke while we still want it: restart on the same conversation.
    this.busy = false;
    this.inbox.length = 0;
    this.wake = null;
    const now = Date.now();
    this.crashes = this.crashes.filter((t) => now - t < 60000).concat(now);
    if (this.crashes.length > 3) {
      this.dead = true;
      this.events.onCrash(`${failure} (parei de tentar: caiu ${this.crashes.length} vezes em um minuto)`);
      return;
    }
    this.events.onCrash(failure);
    setTimeout(() => this.start(), 1000 * this.crashes.length);
  }

  private crashes: number[] = [];
  /** Gave up restarting; requests are refused instead of queued forever. */
  dead = false;

  send(text: string): void {
    if (this.dead) return;
    this.busy = true;
    this.inbox.push(text);
    this.wake?.();
    this.wake = null;
  }

  async interrupt(): Promise<void> {
    await this.q?.interrupt().catch(() => undefined);
  }

  close(): void {
    this.closed = true;
    this.wake?.();
    this.q?.close();
  }
}
