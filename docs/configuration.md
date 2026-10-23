# Configuration

Settings come from environment variables or from `~/.config/handsfree-code/config.env`
(`$XDG_CONFIG_HOME/handsfree-code/config.env` if set). Environment variables win. Start from
[examples/config.env.example](../examples/config.env.example).

The file holds API keys: keep it out of every repository and readable only by you
(`chmod 600`). handsfree-code never writes to it.

## Keys

| Variable | Used for |
|---|---|
| `OPENAI_API_KEY` | Natural voice and fast transcription. Without it: macOS voice and local Whisper. |
| `ELEVENLABS_API_KEY` + `HANDSFREE_ELEVENLABS_VOICE` | Use an ElevenLabs voice instead of OpenAI's. Transcription stays on OpenAI. |

Claude itself uses whatever Claude Code is logged in with on your machine.

## Voice and behavior

| Variable | Default | What it does |
|---|---|---|
| `HANDSFREE_NAME` | `James` | Wake word. Same as `--name`. |
| `HANDSFREE_NAME_SPELLINGS` | | Extra spellings the transcription produces for the name, comma separated (e.g. `djeims,jeimes`). |
| `HANDSFREE_OPENAI_VOICE` | `echo` | OpenAI voice. Male: `echo`, `ash`, `verse`, `onyx`. Female: `coral`, `nova`, `shimmer`. |
| `HANDSFREE_ACCENT` | neutral Brazilian | Accent instruction for the OpenAI voice, in plain words (e.g. `paulistano`). |
| `HANDSFREE_SPEED` | `1.4` | Playback speed, 0.5 to 2. Keeps the pitch. |
| `HANDSFREE_MAC_VOICE` | `Eddy` | macOS voice used as fallback. List with `say -v '?'`. |
| `HANDSFREE_MIC` | first real mic | Part of the input device name (e.g. `AirPods`, `Car`). See `handsfree --mic`. |
| `HANDSFREE_ECHO_TAIL_MS` | `1000` | How long after playback the mic keeps ignoring sound. Raise it if it hears the end of its own sentences over Bluetooth. |
| `HANDSFREE_LOCAL_STT_MODEL` | `small` | Local Whisper model: `base` is faster and less accurate. |
| `HANDSFREE_PYTHON` | `~/.handsfree-code/venv/bin/python` | Python with `faster-whisper` installed. |

Older `VOZ_*` names keep working.

## Choosing a Brazilian voice on ElevenLabs

OpenAI voices are good but can sound slightly foreign in Portuguese. For a native voice, add a
Brazilian voice from the ElevenLabs Voice Library to your account, copy its Voice ID, and set:

```env
ELEVENLABS_API_KEY=...
HANDSFREE_ELEVENLABS_VOICE=<voice id>
```

## Costs

You pay your providers directly. Rough figures, check current pricing:

- Transcription: a few tenths of a cent per minute of speech, including barge-in windows.
- OpenAI voice: about a cent per minute spoken.
- Claude: your Claude Code plan or API usage, same as typing.
