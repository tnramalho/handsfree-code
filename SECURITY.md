# Security policy

## Reporting a vulnerability

Please **do not** open a public issue for security problems.

Use GitHub's private reporting: go to the repository's **Security** tab → **Report a
vulnerability**. You will get an answer within 7 days. Once a fix is released, we credit you in
the release notes unless you prefer otherwise.

## What counts

handsfree-code runs Claude Code with permissions skipped and asks for a spoken confirmation
before heavy actions (see [docs/safety.md](docs/safety.md)). That check is pattern-based and is
documented as **not** a security boundary. Still useful to report:

- A common, non-obscure way to push, deploy, delete outside the project, or send data out that
  runs without asking for confirmation.
- A way for audio, a file in the repo, or tool output to approve a confirmation without the user
  saying the wake word.
- API keys or audio leaking to logs, files, or anywhere other than the configured provider.
- Anything that makes the tool act on speech when the wake word was not said, outside the
  documented follow-up window.

## Supported versions

Only the latest release gets fixes while the project is 0.x.
