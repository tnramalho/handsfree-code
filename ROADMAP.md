# Roadmap

Ideas in rough priority order. Each has (or will have) an issue; comment there before starting.

## Next

- **Real echo cancellation.** A small Swift helper using macOS Voice Processing I/O
  (`AVAudioEngine` with voice processing enabled) for capture and playback. Interrupting would
  become instant and would no longer need a transcription per window.
- **Answer in English.** Make the assistant's spoken language configurable (rules, short
  phrases, transcription language). Command words already work in English.
- **Session summary on quit.** "James, bye" writes a short handoff file so the next session, or
  you at the keyboard, can pick up.

## Later

- **Linux support.** PulseAudio/PipeWire capture and playback, `espeak-ng` or Piper as the free
  voice.
- **Phone call mode.** Call a number from the car (CarPlay hands-free) and talk to the same
  session; it calls you back when long work ends.
- **Bluetooth headset presets.** Auto-detect AirPods and car audio and tune the echo tail.
- **Sandbox preset.** Optional Claude Code sandbox settings (write only in the project, network
  allowlist) for untrusted repositories.
- **npm package.** `npx handsfree-code`.

## Not planned

- A GUI. The point is not to need a screen.
