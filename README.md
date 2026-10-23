# handsfree-code

**Talk to Claude Code by voice when you can't look at a screen.** You speak, it works in your
repo, and it answers out loud: short, direct, interruptible. Built for driving, cooking,
walking the dog, or any moment your hands and eyes are busy.

> Portuguese (Brazil) first. Leia em português: [README.pt-BR.md](README.pt-BR.md)

```text
You:   James, create a branch to fix the Node version and run the tests.
James: Ok, on it.
       ...
James: Branch created, Node bumped in both images, 40 tests passing. Commit it?
You:   (talking to a passenger)        ← ignored: you didn't say "James"
You:   James, commit and push.
James: Before I go on: I'm about to push commits to the remote. Call me and say confirm, or call me and say no.
You:   James, confirm.
```

## Why

Coding agents already do the work; the bottleneck is that you have to sit and watch. This tool
removes the screen from the loop:

- **Wake word.** It listens all the time but only acts when you call it by name (default
  `James`). A conversation with someone else in the car is ignored.
- **Spoken confirmation for heavy actions.** It runs like Claude Code with permissions skipped,
  except that `git push`, PRs, deploys, publishing, `sudo`, remote servers, and deleting or
  editing files outside the project are paused until you say the name plus "confirm".
- **Interruptible.** "James, stop" cuts the speech and the current task, even mid-sentence
  (mid-sentence needs the OpenAI key; without it, it hears you once it finishes the sentence).
- **Short answers.** At most two spoken sentences; a closing question is always kept.
- **Context from where you left off.** Start from a handoff file or continue an existing Claude
  Code session.
- **Worktrees.** Work on a separate branch checkout without touching your main one.

## Requirements

- macOS (uses the built-in audio stack and `say`). Linux is on the [roadmap](ROADMAP.md).
- Node.js 22+ and `ffmpeg` (`brew install ffmpeg`).
- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) installed and logged in. It runs
  on your own Claude plan or API key.
- Recommended: an OpenAI API key for natural voice and ~1 s transcription. Without it, the macOS
  voice and a local Whisper model are used (free, slower).

## Install

```bash
git clone https://github.com/tnramalho/handsfree-code.git
cd handsfree-code
npm install
npm run build
npm link
```

Optional, the free local transcription fallback:

```bash
python3 -m venv ~/.handsfree-code/venv
~/.handsfree-code/venv/bin/pip install faster-whisper
```

Optional, keys and preferences in `~/.config/handsfree-code/config.env` (see
[examples/config.env.example](examples/config.env.example)). Keep this file out of any repo.

```bash
mkdir -p ~/.config/handsfree-code
cp examples/config.env.example ~/.config/handsfree-code/config.env
chmod 600 ~/.config/handsfree-code/config.env
```

The first run asks for microphone permission for your terminal app.

## Use

```bash
cd path/to/your/project
handsfree
```

| Command | What it does |
|---|---|
| `handsfree` | Start in the current folder. |
| `handsfree -w fix/login` | Create or reuse a worktree for `fix/login` and work there. |
| `handsfree --handoff notes/handoff.md` | Read a handoff file and tell you where things stand. |
| `handsfree --continue` | Continue the most recent Claude Code session in this folder (as a copy). |
| `handsfree --session <id>` | Continue a specific session (as a copy). |
| `handsfree --name Ana` | Use another wake word. |
| `handsfree --mic` | Microphone level meter. |

`voz` is an alias for `handsfree`. Portuguese flags (`--nome`, `--continuar`, `--sessao`) also work.

### What to say

| Say | Result |
|---|---|
| "James" | Beep, then "Opa, diga." and the next phrase counts as for it (queued if it is busy). |
| "James, run the tests" | Does it. |
| (right after it asks something) "yes, go" | Within 20 s after it finishes, you can answer without the name. |
| "James, stop" | Stops talking and stops the task. Works mid-sentence with the OpenAI key. |
| "James" while it is talking | Cuts the speech, then "Opa, diga." and listens to your full request. |
| "James, confirm" / "James, no" | Answers a confirmation for a heavy action. |
| "James, open the worktree for branch X" | Switches to that worktree. |
| "James, bye" | Quits. |

Command words work in Portuguese and English ("para"/"stop", "confirma"/"confirm",
"não"/"no", "tchau"/"bye"). The assistant itself answers in Portuguese for now. Requests made
while it is working go into a queue.

## Learn more

- [Use cases and examples](docs/use-cases.md): driving, cooking, walking, accessibility, and how
  to structure a session.
- [How it works](docs/architecture.md)
- [Configuration](docs/configuration.md)
- [Safety model and its limits](docs/safety.md). Read this before using it on a repo that matters.
- [Troubleshooting](docs/troubleshooting.md)
- [Roadmap](ROADMAP.md) · [Contributing](CONTRIBUTING.md) · [Security](SECURITY.md)

## Status

Early (0.x). It is used daily on the author's Mac, but expect rough edges. Issues and pull
requests are welcome.

## Disclaimer

This is an independent project. It is not affiliated with, endorsed by, or sponsored by
Anthropic or OpenAI. "Claude" and "Claude Code" are trademarks of Anthropic; they are used here
only to describe what this tool works with.

Don't operate a screen while driving. The tool is designed so you never need to look at it, but
your attention on the road comes first.

## License

[MIT](LICENSE)
