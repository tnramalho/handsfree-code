# Troubleshooting

The terminal shows what is happening. You don't need to watch it, but it is the first place to
look when something feels off.

| Symptom | Likely cause | Fix |
|---|---|---|
| Says "the microphone is arriving muted" | Your terminal app has no microphone permission. | System Settings → Privacy & Security → Microphone → enable your terminal, then reopen it. |
| Never reacts | Wrong input device, or the name is transcribed differently. | Run `handsfree --mic` and speak: the bar must pass the vertical line. Set `HANDSFREE_MIC`. Look for `(ignorado, não me chamou)` lines and add the spelling you see to `HANDSFREE_NAME_SPELLINGS`. |
| Reacts to conversations not meant for it | Another word sounds like the name. | Use a less common name with `--name`. |
| Hears the end of its own sentences | Bluetooth or car audio delay. | Raise `HANDSFREE_ECHO_TAIL_MS` to 1500 or 2000. |
| Long pause before every answer | No OpenAI key: local transcription takes several seconds. | Set `OPENAI_API_KEY`, or `HANDSFREE_LOCAL_STT_MODEL=base`. |
| Voice sounds foreign | OpenAI voice accent. | Try another `HANDSFREE_OPENAI_VOICE`, or use ElevenLabs (see [configuration.md](configuration.md)). |
| "James, stop" takes a second or two | Expected: it has to transcribe the window first. | See the echo cancellation item on the [roadmap](../ROADMAP.md). |
| Can't interrupt mid-sentence | No OpenAI key: barge-in needs fast transcription. | Set `OPENAI_API_KEY`, or wait for it to finish the sentence. |
| "ffmpeg não encontrado" | ffmpeg is not installed. | `brew install ffmpeg` |
| "Claude caiu, tô reabrindo" | The Claude Code process exited. It restarts on the same conversation, up to 3 times a minute. | If it keeps happening, run `claude` directly in the folder to see the error. |
| Asked for confirmation on something harmless | The pattern matched. | Say "James, confirm". If it is common, open an issue with the command. |
| `--continue` says there is no session | No Claude Code session was started in this folder. | Run it from the same folder you used `claude` in, or pass `--session <id>`. |
