---
name: 9router-tts
description: Text-to-speech via 9Router /v1/audio/speech using OpenAI / ElevenLabs / Deepgram / Edge TTS / Google TTS / Hyperbolic / Inworld / OmniVoice voices. Use when the user wants to convert text to speech, generate audio, voiceover, narrate, or read text aloud.
---

# 9Router — Text-to-Speech

Requires `NINEROUTER_URL` (and `NINEROUTER_KEY` if auth enabled). See https://raw.githubusercontent.com/decolua/9router/refs/heads/master/skills/9router/SKILL.md for setup.

## Discover

```bash
# 1) List models
curl $NINEROUTER_URL/v1/models/tts | jq '.data[].id'
# 2) Per-model metadata (params, voicesUrl if voice-by-id)
curl "$NINEROUTER_URL/v1/models/info?id=el/eleven_multilingual_v2"
# 3) List voices (elevenlabs, edge-tts, deepgram, inworld, local-device). Optional ?lang=vi
curl "$NINEROUTER_URL/v1/audio/voices?provider=edge-tts&lang=vi" | jq '.data[].model'
```

`model` field in `/v1/audio/speech` = voice ID directly (e.g. `edge-tts/vi-VN-HoaiMyNeural`, `el/<voice_id>`, or `openai/tts-1` model+default voice).

## Endpoint

`POST $NINEROUTER_URL/v1/audio/speech`

| Field | Required | Notes |
|---|---|---|
| `model` | yes | voice ID from `/v1/models/tts` |
| `input` | yes | text to speak |

Query `?response_format=mp3` (default, raw bytes) or `?response_format=json` (`{audio: base64, format}`).

## Examples

Save MP3:

```bash
curl -X POST "$NINEROUTER_URL/v1/audio/speech" \
  -H "Authorization: Bearer $NINEROUTER_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"openai/tts-1","input":"Hello world"}' \
  --output speech.mp3
```

JS (save file):

```js
import { writeFile } from "node:fs/promises";
const r = await fetch(`${process.env.NINEROUTER_URL}/v1/audio/speech`, {
  method: "POST",
  headers: { "Authorization": `Bearer ${process.env.NINEROUTER_KEY}`, "Content-Type": "application/json" },
  body: JSON.stringify({ model: "el/eleven_multilingual_v2", input: "Xin chào" }),
});
await writeFile("speech.mp3", Buffer.from(await r.arrayBuffer()));
```

## Response shape

Default → raw audio bytes (Content-Type `audio/mp3`).

`?response_format=json`:
```json
{ "audio": "SUQzBAAAA...", "format": "mp3" }
```

## Provider quirks (model format)

| Provider | `model` format | Notes |
|---|---|---|
| `openai` | `tts-1/alloy` (model/voice) or just voice | Default model `gpt-4o-mini-tts` |
| `elevenlabs` | `<model_id>/<voice_id>` or `<voice_id>` | Default model `eleven_flash_v2_5`; list voices in Dashboard |
| `openrouter` | `openai/gpt-4o-mini-tts/alloy` | Streamed via chat-completions audio modality |
| `edge-tts` | voice id e.g. `vi-VN-HoaiMyNeural` | **noAuth**; default `vi-VN-HoaiMyNeural` |
| `google-tts` | language code e.g. `en`, `vi` | **noAuth** |
| `local-device` | OS voice name (`say -v ?` / SAPI) | **noAuth**; needs `ffmpeg` |
| `deepgram` | `aura-asteria-en` etc | Token auth |
| `nvidia`, `inworld`, `cartesia`, `playht` | `model/voice` | Provider-specific auth header |
| `coqui`, `tortoise` | speaker / voice id | Localhost noAuth |
| `hyperbolic` | model id | Body = `{text}` only |
| `omnivoice` | `design/<tokens>` or `clone` | **noAuth**; 600+ languages, voice cloning — see below |

## OmniVoice (600+ languages, voice cloning)

Free and keyless — it proxies the public [k2-fsa/OmniVoice](https://huggingface.co/spaces/k2-fsa/OmniVoice)
Space, which runs on shared ZeroGPU quota. Two modes:

**Design** — the voice is a dash-joined token list, not a voice id:

```bash
curl -X POST "$NINEROUTER_URL/v1/audio/speech" \
  -H "Authorization: Bearer $NINEROUTER_KEY" -H "Content-Type: application/json" \
  -d '{"model":"omnivoice/design/female-young","input":"Xin chào","language":"vi"}' \
  --output speech.wav
```

Tokens (any order, every slot optional): `male|female` · `child|teen|young|middle-aged|elderly` ·
`vlow|low|mid|high|vhigh` · `whisper` · accent `us|uk|au|ca|indian|korean|japanese|portuguese|russian|chinese` ·
Chinese dialect `henan|shaanxi|sichuan|guizhou|yunnan|guilin|jinan|shijiazhuang|gansu|ningxia|qingdao|northeast`.

**Clone** — pass the sample inline as `reference_audio` (base64 or `data:` URI; a URL is
rejected on purpose, the router will not fetch arbitrary hosts). `reference_text` is optional
but improves the result:

```bash
curl -X POST "$NINEROUTER_URL/v1/audio/speech" \
  -H "Authorization: Bearer $NINEROUTER_KEY" -H "Content-Type: application/json" \
  -d "{\"model\":\"omnivoice/clone\",\"input\":\"Câu cần đọc\",\"language\":\"vi\",\"reference_audio\":\"$(base64 -w0 sample.wav)\"}" \
  --output cloned.wav
```

Notes:
- `language` accepts a name (`Vietnamese`) or an ISO code (`vi`, `vi-VN`); omit it to let the model detect.
- Output is always 24kHz WAV — `response_format` only chooses raw bytes vs. base64 JSON.
- The shared Space's anonymous GPU quota runs out after a handful of calls and then every request
  fails with `OmniVoice Space error`. Set `OMNIVOICE_HF_TOKEN` (Hugging Face token) and/or
  `OMNIVOICE_BASE_URL` (your own duplicate of the Space, or a self-hosted copy) to avoid it.
