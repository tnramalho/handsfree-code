# How it works

One Node.js process on your Mac. No server, no web page.

```text
 mic ──► ffmpeg (avfoundation, 16 kHz mono)
           │
           ▼
      energy VAD (src/mic.ts) ── phrase ──► transcription (src/stt.ts)
           │                                  OpenAI gpt-4o-mini-transcribe
           │ while speaking:                  └─ fallback: local faster-whisper
           │ 2.4 s windows every 1.2 s
           ▼                                         │
      barge-in check ◄── name found? ─────────────── ▼
           │                                  wake word (src/wake.ts)
           │                                  + command words (src/commands.ts)
           ▼                                         │
      stop speech / stop task                        ▼
                                          Claude Agent SDK session (src/session.ts)
                                          one long-lived process, streaming input
                                          PreToolUse hook ──► heavy action? (src/guard.ts)
                                                 │                 │
                                                 │           ask by voice, wait for
                                                 │           "James, confirm"
                                                 ▼
                                          assistant text ──► at most 2 sentences (src/voice-text.ts)
                                                                   │
                                                                   ▼
                                          speech (src/tts.ts): OpenAI gpt-4o-mini-tts
                                          streamed into ffmpeg → speakers, 1.4x tempo
                                          or ElevenLabs (if configured); fallback: macOS `say`
```

## Modules

| File | Responsibility |
|---|---|
| `src/index.ts` | CLI, conversation state (queue, follow-up window, confirmations, interruption). |
| `src/mic.ts` | Microphone capture, voice activity detection, barge-in windows. |
| `src/stt.ts` | Speech to text. Never throws: no network and no local model means "heard nothing". |
| `src/wake.ts` | Finds the wake word and strips it (and "ô", "ei") from the request. |
| `src/commands.ts` | Stop, yes, no, quit and worktree phrases. |
| `src/session.ts` | The Claude Code session: kept alive between requests, restarts itself on crash. |
| `src/guard.ts` | Decides which tool calls need a spoken confirmation. |
| `src/voice-text.ts` | Shortens what gets spoken. |
| `src/tts.ts` | Text to speech, queue, cancellation, cached short phrases. |
| `src/worktree.ts` | Creates worktrees next to the main repo. |
| `stt_worker.py` | Local Whisper model, kept loaded, one request per line on stdin. |

## Design decisions

**One long-lived Claude session.** Starting Claude Code per request cost about 5.5 s before the
first word, mostly loading the user's MCP servers. Keeping one process open and sending each
request on the same stream brings that to about 1.6 s. The session loads only project settings
(`settingSources: ['project', 'local']`) and no MCP servers.

**Wake word instead of always answering.** In a car or a kitchen, most speech isn't for the
agent. Requiring the name keeps it quiet. Right after a turn you asked for ends, there is a 20 s
window to answer without the name; it is not reopened by short acknowledgements, so background
chatter can't keep it alive.

**Confirmation instead of blocking.** Blocking heavy actions made the tool less useful than
Claude Code itself. Asking out loud keeps the power and puts the human in the loop for what
can't be undone. See [safety.md](safety.md).

**Barge-in without echo cancellation.** There is no acoustic echo cancellation in this pipeline,
so while it speaks it can't tell your voice from its own by volume. Instead it transcribes short
overlapping windows and looks only for the name. The rules tell Claude never to say its own name,
and no built-in phrase contains it, including the confirmation question ("call me and say
confirm"). A barge-in only ever cuts the speech: "name + stop" also stops the task, anything else
gets "Opa, diga." and the full request is heard afterwards. It never answers a confirmation, since
that window may hold the assistant's own voice. This costs about one transcription per 1.2 s of
speech, takes 1 to 2 s to react, and needs the OpenAI key (the local model is too slow for it). Real echo cancellation
(macOS Voice Processing I/O) is on the [roadmap](../ROADMAP.md).

**Speech starts before the download ends.** Audio is streamed into ffmpeg, short phrases are
cached at startup, and the connection is warmed, so acknowledgements play immediately.

## Measured latency (author's M-series Mac, warm connection)

| Step | Time |
|---|---|
| End of your phrase detected | 0.8 s of silence |
| Transcription (OpenAI) | ~1 s |
| Acknowledgement ("Ok, on it.") | immediate (cached) |
| Claude's first words | ~1.6 s after the request |
| First audio of a new sentence | ~0.8 s |
