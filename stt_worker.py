import os
import sys
import warnings

warnings.filterwarnings("ignore")
from faster_whisper import WhisperModel

model = WhisperModel(os.environ.get("VOZ_STT_MODEL", "small"), device="cpu", compute_type="int8")
print("ready", flush=True)

for line in sys.stdin:
    path = line.strip()
    if not path:
        continue
    try:
        segments, _ = model.transcribe(
            path,
            language="pt",
            beam_size=1,
            vad_filter=True,
            initial_prompt=os.environ.get("VOZ_STT_PROMPT") or None,
        )
        text = " ".join(s.text.strip() for s in segments).replace("\n", " ")
    except Exception as exc:  # noqa: BLE001
        text = ""
        print(f"error {exc}", file=sys.stderr, flush=True)
    print("text " + text, flush=True)
