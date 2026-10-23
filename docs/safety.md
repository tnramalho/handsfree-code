# Safety model and its limits

handsfree-code runs Claude Code with **permissions skipped** (`bypassPermissions`), so it can
work without anyone clicking "allow". That is the same trust level as
`claude --dangerously-skip-permissions`. Read this before pointing it at a repo that matters.

## What it does to protect you

Before any tool call runs, a `PreToolUse` hook (`src/guard.ts`) checks whether it is a **heavy
action**. If so, the agent stops and asks out loud:

> "Before I go on: I'm about to push commits to the remote. Call me and say confirm, or call me
> and say no."

It only proceeds when you say the wake word plus a confirmation, and nothing else: "James,
confirm", "James, sim", "James, pode sim". "James, no", "James, stop" (which also stops the
task), anything unclear, or 90 seconds of silence means no. Several heavy actions at once are
asked one at a time.

- Requiring the name means a passenger saying "yes" cannot approve anything.
- The question itself never contains the name, and an interruption while it is speaking can
  never answer a confirmation, so its own voice coming back through the speaker cannot approve
  anything either.

Heavy actions:

- `git push` (any form), force push, deleting remote branches
- GitHub CLI: create or merge PRs, releases, write calls to the API
- `npm`/`pnpm`/`yarn`/`bun` publish, `run deploy|release`, `make deploy`, deploy scripts, and
  deploy tools (Vercel, Netlify, Fly, Railway, Wrangler, Firebase, Heroku)
- `ssh`, `scp`, `sftp`, remote `rsync`, remote Docker
- `git reset --hard`, `git clean -f`, `git branch -D`, discarding changes
- `sudo`
- `rm -r` / `mv` that reach outside the project folder or remove the folder itself (following
  `cd` in chained commands), and any `find -delete`
- `curl` sending data out (`-d`, `-F`, `-T`, `POST`, `PUT`)
- Writing or editing files outside the project, inside `.git/`, or in `.claude/settings*`

Everything else (reading, editing project files, running tests, local commits, branches,
worktrees) runs without asking.

## What it does not protect you from

The heavy-action check matches **patterns**. It catches accidents and the common ways to do
something irreversible. It is **not a security boundary**:

- A determined or prompt-injected agent can find a spelling the patterns don't cover (for
  example a script it writes inside the project and then runs).
- Network access is not restricted. Code the agent runs can reach the internet.
- Reading is not restricted. The agent can read files your user can read, including keys.

If you work on repositories with untrusted content (third-party code, issues, web pages the
agent may fetch), treat it like running Claude Code with permissions skipped on that repo,
because that is what it is. For stronger isolation, run it in a disposable checkout or a VM, or
use Claude Code's [sandbox settings](https://docs.anthropic.com/en/docs/claude-code/settings)
in the project's `.claude/settings.json`; this tool loads project settings.

## Secrets

- API keys live only in `~/.config/handsfree-code/config.env`, outside any repo.
- The tool never logs keys. The terminal shows what you said, tool names, and short commands.
- Audio is sent to OpenAI (or ElevenLabs) for transcription and speech when keys are set. With no
  keys, audio never leaves your machine.

## Reporting a problem

See [SECURITY.md](../SECURITY.md).
