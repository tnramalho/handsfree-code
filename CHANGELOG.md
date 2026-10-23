# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses
[Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.1.0] - 2026-10-23

First public version.

### Added

- `handsfree` command (alias `voz`): talk to Claude Code by voice in the current folder.
- Wake word (default `James`, `--name` to change) with a 20 s follow-up window after a turn.
- Spoken confirmation before heavy actions: push, PRs, deploys, publishing, `sudo`, remote
  servers, deleting or editing outside the project.
- Interrupting mid-sentence with "James, stop" (Portuguese and English command words).
- One long-lived Claude Code session that restarts itself if it crashes.
- `--handoff <file>`, `--continue` and `--session <id>` to start from existing context.
- `-w <branch>` and spoken commands to work in git worktrees.
- OpenAI voice and transcription, with ElevenLabs and macOS voice and local Whisper as
  alternatives.
- `--mic` microphone level meter.

[Unreleased]: https://github.com/tnramalho/handsfree-code/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/tnramalho/handsfree-code/releases/tag/v0.1.0
