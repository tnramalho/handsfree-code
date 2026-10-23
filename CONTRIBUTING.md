# Contributing

Thanks for helping. Issues, ideas and pull requests are welcome, in English or Portuguese.

## Before you start

- **Bugs:** open an issue with the bug template. Include the terminal output around the problem
  (remove anything private) and your macOS, Node and audio device.
- **Features:** open an issue or a discussion first, so we agree on the shape before you write
  code. Check the [roadmap](ROADMAP.md).
- **Security problems:** do not open a public issue. See [SECURITY.md](SECURITY.md).

## Development

```bash
git clone https://github.com/tnramalho/handsfree-code.git
cd handsfree-code
npm install
npm test          # builds and runs the unit tests
npm run typecheck
```

Run your local build from any folder with `npm link`, then `handsfree`.

Tests cover the parts that don't need audio: wake word, command words, the heavy-action guard,
spoken text shortening, worktrees and WAV encoding. Audio and the Claude session are tested by
hand; describe what you tried in the pull request.

## Pull requests

- Branch from `main`. `main` is protected: every change goes through a pull request and needs CI
  to pass.
- Keep a pull request to one change. Small is reviewed fast.
- Add or update tests for behavior you change. A change to `src/guard.ts` must come with tests
  for both what now asks and what still runs freely.
- Update the docs and `CHANGELOG.md` (under "Unreleased") when behavior changes.
- Follow the existing code style: TypeScript strict, ES modules, no comments that restate the
  code, comments that explain why.
- Never commit keys, recordings, or personal paths.

## Commit messages

[Conventional Commits](https://www.conventionalcommits.org/): `feat: ...`, `fix: ...`,
`docs: ...`, `test: ...`, `chore: ...`.

## Releases

Maintainers tag `vX.Y.Z` on `main`; the release workflow builds, tests, and publishes the GitHub
release notes from `CHANGELOG.md`.

## Code of conduct

This project follows the [Contributor Covenant](CODE_OF_CONDUCT.md).
