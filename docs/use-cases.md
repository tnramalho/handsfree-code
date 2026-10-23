# Use cases and examples

handsfree-code is for moments when you can talk and listen but cannot read or type. The agent
does the work in your repo; you steer it with short spoken requests and hear short answers.

## Where it fits

| Situation | Setup that works | Tips |
|---|---|---|
| **Driving** | Laptop open and plugged in (or closed with an external display), car Bluetooth as mic and speaker, mobile hotspot or Starlink. | Give it a well-scoped task before you leave. Answer its questions with the name. Approve pushes when you park. |
| **Cooking, cleaning, workshop** | Laptop on the counter, built-in mic or a headset. | Long tasks ("run the full test suite and fix what fails") and check in now and then. |
| **Walking, treadmill, gym** | Laptop at home on Wi-Fi; Bluetooth headset is the next step on the [roadmap](../ROADMAP.md). | Use `--continue` to pick up the session you left on your desk. |
| **Hands or eyes unavailable** (injury, RSI, low vision) | Any of the above, plus a higher `HANDSFREE_SPEED` once you are used to it. | The wake word and spoken confirmations mean you never need the keyboard to stay safe. |
| **Pairing in a meeting room** | One laptop, the team talks to it. | Use a distinct name (`--name Ana`) so normal conversation doesn't trigger it. |

## How to structure a session

The agent is good at doing; it can't see your face. Sessions go best in four steps.

1. **Set context before you leave.** Write a handoff file or keep the Claude Code session you
   were using, then start with it:

   ```bash
   handsfree --handoff notes/handoff.md
   ```

   ```bash
   handsfree --continue
   ```

   See [examples/handoff.md](../examples/handoff.md) for a template. It asks the agent to read
   it and tell you, in one sentence, where things stand.

2. **Give one outcome at a time.** "James, fix the failing login test and run the suite" works
   better than a list of five things. It tells you the plan in one sentence before long work.

3. **Let it report milestones.** It speaks only at milestones ("tests running", "two tests
   failed, fixing"). Ask "James, how are we doing?" any time.

4. **Approve what leaves your machine.** Commits stay local. Anything that pushes, deploys or
   touches files outside the project waits for you to call it and say "confirm". When in doubt, say "James, no"
   and do it later at the keyboard.

## Example conversations

### Fix and verify on a branch

```text
You:   James, open the worktree for branch fix/node-brotli.
James: Done, I'm in the fix/node-brotli worktree, in a new conversation.
You:   James, pin Node to 22.23.4 in both Dockerfiles and run the tests.
James: Ok, on it.
James: Pinned in both images. Tests are running.
James: All 120 passing. Want me to commit?
You:   Yes, commit with "fix: pin node".          ← no name needed right after a question
James: Committed locally. Push?
You:   James, no, I'll push when I get there.
```

### Investigate without changing anything

```text
You:   James, why is the checkout test flaky? Don't change code, just tell me.
James: It depends on the system clock crossing midnight. Want me to write a fix?
```

### Stop a runaway task

```text
James: I'm rewriting the payment module to use the new client, starting with...
You:   James, stop.
James: Stopped.
You:   James, only update the import, nothing else.
```

### Ignore the passenger

```text
Passenger: Can we stop for gas?
You:       Sure, next exit.                  ← ignored, no name
You:       James, how's the build?
James:     Still compiling, about a minute left.
```

## Writing a good handoff

A handoff is a short Markdown file the agent reads before you start. Keep it under a page:

- **Goal:** the outcome, in one line.
- **Where we are:** what is done, what is in progress.
- **Next step:** the first thing you want done.
- **Constraints:** what not to touch, which branch, which tests matter.
- **Done means:** how you'll know it worked.

Template: [examples/handoff.md](../examples/handoff.md).

## What it is not good at (yet)

- Reading code to you. It summarizes instead, by design.
- Long back-and-forth design discussions. Have those at the keyboard.
- Loud environments without a headset: the wake word may be missed.
- Answering in a language other than Portuguese (planned; command words already work in English).
