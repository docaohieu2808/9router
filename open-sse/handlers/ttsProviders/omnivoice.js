// OmniVoice (k2-fsa) — TTS and voice cloning for 600+ languages, served by a Gradio
// Space rather than a REST API. https://huggingface.co/spaces/k2-fsa/OmniVoice
//
// Two calls per synthesis, which is Gradio's queue protocol and not something we can
// collapse: POST /gradio_api/call/<fn> hands back an event id, and GET on that id
// streams SSE until an `event: complete` carries the result. The audio itself is a
// file reference, so a third request downloads it.
//
// A SPECIAL_ADAPTER rather than a genericFormats handler because none of that fits the
// single-request { baseUrl, apiKey, text, modelId, voiceId } shape those handlers have.
//
// The Space is public and needs no credential, so the provider is registered noAuth.
// Two env vars cover the cases where the default is wrong:
//   OMNIVOICE_BASE_URL   — point at your own duplicate of the Space (or a self-hosted
//                          copy) instead of the shared community one, whose ZeroGPU
//                          quota is shared by every anonymous caller.
//   OMNIVOICE_HF_TOKEN   — Hugging Face token, required for a private Space and used
//                          for quota attribution on a public one.
import { Buffer } from "node:buffer";
import { randomUUID } from "node:crypto";
import { resolveOmnivoiceLanguage } from "../../config/omnivoiceLanguages.js";
import { responseToBase64 } from "./_base.js";

const DEFAULT_BASE_URL = "https://k2-fsa-omnivoice.hf.space";
const DESIGN_MODEL = "design";
const CLONE_MODEL = "clone";
const MODELS = [DESIGN_MODEL, CLONE_MODEL];

// The ZeroGPU queue can hold a request for a while before the GPU is granted; a short
// timeout would turn a queued call into a spurious failure. ~4s is typical once running.
const REQUEST_TIMEOUT_MS = Number(process.env.OMNIVOICE_TIMEOUT_MS || 180000);
const MAX_REF_AUDIO_BYTES = 10 * 1024 * 1024;

// Inference defaults, mirroring the Space's own slider defaults.
const DEFAULTS = { steps: 32, cfg: 2.0, denoise: true, speed: 1.0, duration: null, preprocess: true, postprocess: true };

// ── Voice tokens ────────────────────────────────────────────────────────────
// The design endpoint has no voice ids — a voice is a combination of dropdowns. So a
// 9router voice is a dash-joined token list ("female-young", "male-elderly-low"), each
// token naming one dropdown value. Order does not matter; every slot defaults to Auto.
const AUTO = "Auto";

const VOICE_TOKENS = {
  // gender
  male: ["gender", "Male / 男"],
  m: ["gender", "Male / 男"],
  female: ["gender", "Female / 女"],
  f: ["gender", "Female / 女"],
  // age
  child: ["age", "Child / 儿童"],
  teen: ["age", "Teenager / 少年"],
  teenager: ["age", "Teenager / 少年"],
  young: ["age", "Young Adult / 青年"],
  adult: ["age", "Young Adult / 青年"],
  middle: ["age", "Middle-aged / 中年"],
  "middle-aged": ["age", "Middle-aged / 中年"],
  elderly: ["age", "Elderly / 老年"],
  old: ["age", "Elderly / 老年"],
  // pitch
  vlow: ["pitch", "Very Low Pitch / 极低音调"],
  low: ["pitch", "Low Pitch / 低音调"],
  mid: ["pitch", "Moderate Pitch / 中音调"],
  moderate: ["pitch", "Moderate Pitch / 中音调"],
  high: ["pitch", "High Pitch / 高音调"],
  vhigh: ["pitch", "Very High Pitch / 极高音调"],
  // style
  whisper: ["style", "Whisper / 耳语"],
  // English accent
  american: ["accent", "American Accent / 美式口音"],
  us: ["accent", "American Accent / 美式口音"],
  british: ["accent", "British Accent / 英国口音"],
  uk: ["accent", "British Accent / 英国口音"],
  australian: ["accent", "Australian Accent / 澳大利亚口音"],
  au: ["accent", "Australian Accent / 澳大利亚口音"],
  canadian: ["accent", "Canadian Accent / 加拿大口音"],
  ca: ["accent", "Canadian Accent / 加拿大口音"],
  indian: ["accent", "Indian Accent / 印度口音"],
  korean: ["accent", "Korean Accent / 韩国口音"],
  japanese: ["accent", "Japanese Accent / 日本口音"],
  portuguese: ["accent", "Portuguese Accent / 葡萄牙口音"],
  russian: ["accent", "Russian Accent / 俄罗斯口音"],
  chinese: ["accent", "Chinese Accent / 中国口音"],
  // Chinese dialect
  henan: ["dialect", "Henan Dialect / 河南话"],
  shaanxi: ["dialect", "Shaanxi Dialect / 陕西话"],
  sichuan: ["dialect", "Sichuan Dialect / 四川话"],
  guizhou: ["dialect", "Guizhou Dialect / 贵州话"],
  yunnan: ["dialect", "Yunnan Dialect / 云南话"],
  guilin: ["dialect", "Guilin Dialect / 桂林话"],
  jinan: ["dialect", "Jinan Dialect / 济南话"],
  shijiazhuang: ["dialect", "Shijiazhuang Dialect / 石家庄话"],
  gansu: ["dialect", "Gansu Dialect / 甘肃话"],
  ningxia: ["dialect", "Ningxia Dialect / 宁夏话"],
  qingdao: ["dialect", "Qingdao Dialect / 青岛话"],
  northeast: ["dialect", "Northeast Dialect / 东北话"],
};

// "middle-aged" is a two-word token in a dash-joined list, so it has to be pulled out
// before the string is split on dashes.
const MULTI_WORD_TOKENS = ["middle-aged"];

/** Turn "female-young-british" into the Space's six design dropdown values. */
export function parseVoiceTokens(voice, style) {
  const slots = { gender: AUTO, age: AUTO, pitch: AUTO, style: AUTO, accent: AUTO, dialect: AUTO };
  let rest = String(voice || "").trim().toLowerCase().replace(/[_\s]+/g, "-");

  const tokens = [];
  for (const multi of MULTI_WORD_TOKENS) {
    if (rest.includes(multi)) {
      tokens.push(multi);
      rest = rest.replace(multi, "-");
    }
  }
  tokens.push(...rest.split("-").filter(Boolean));

  for (const token of tokens) {
    const mapped = VOICE_TOKENS[token];
    if (!mapped) {
      throw new Error(
        `OmniVoice: unknown voice token "${token}". Use tokens like female, male, child, young, elderly, low, high, whisper, british.`
      );
    }
    slots[mapped[0]] = mapped[1];
  }

  // `style` from the request body is a free-form hint everywhere else in 9router; the
  // design endpoint only understands its one Whisper preset, so honour that and ignore
  // the rest rather than failing a request over a hint.
  if (slots.style === AUTO && /whisper/i.test(String(style || ""))) slots.style = VOICE_TOKENS.whisper[1];

  return slots;
}

/** Split "design/female-young" into a mode and a voice. A bare value is a voice. */
export function parseOmnivoiceModel(model) {
  const raw = String(model || "").trim();
  if (!raw) return { mode: DESIGN_MODEL, voice: "" };

  const [head, ...tail] = raw.split("/");
  if (MODELS.includes(head.toLowerCase())) {
    return { mode: head.toLowerCase(), voice: tail.join("/") };
  }
  return { mode: DESIGN_MODEL, voice: raw };
}

// ── Gradio queue protocol ───────────────────────────────────────────────────
/**
 * Parse the SSE body of a Gradio result stream.
 * Events arrive as blank-line-separated blocks of `event:` / `data:` lines; only
 * `complete` carries output, and `error` carries the upstream failure (ZeroGPU quota
 * exhaustion shows up here, not as a non-200).
 */
export function parseGradioStream(text) {
  let payload = null;

  for (const block of String(text).split(/\r?\n\r?\n/)) {
    if (!block.trim()) continue;
    let event = null;
    const dataLines = [];
    for (const line of block.split(/\r?\n/)) {
      if (line.startsWith("event:")) event = line.slice(6).trim();
      else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
    }
    if (!event) continue;
    const data = dataLines.join("\n");

    if (event === "error") {
      let message = data;
      try {
        const parsed = JSON.parse(data);
        message = parsed?.message || parsed?.error || (typeof parsed === "string" ? parsed : data);
      } catch { /* plain-text error */ }
      throw new Error(`OmniVoice Space error: ${message || "unknown error"}`);
    }
    if (event === "complete") {
      try { payload = JSON.parse(data); } catch { throw new Error("OmniVoice: malformed result from Space"); }
    }
  }

  if (!payload) throw new Error("OmniVoice: Space closed the stream without a result");
  return payload;
}

function authHeaders(token) {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function readError(res, label) {
  const text = await res.text().catch(() => "");
  let detail = text;
  try {
    const parsed = JSON.parse(text);
    detail = parsed?.detail || parsed?.error || parsed?.message || text;
    if (typeof detail === "object") detail = JSON.stringify(detail);
  } catch { /* plain-text body */ }
  return new Error(`OmniVoice ${label} failed (${res.status})${detail ? `: ${String(detail).slice(0, 300)}` : ""}`);
}

/** Upload reference audio bytes to the Space; returns the FileData the endpoint wants. */
async function uploadReferenceAudio(base, token, buffer, signal) {
  const form = new FormData();
  form.append("files", new Blob([buffer], { type: "audio/wav" }), "reference.wav");

  const res = await fetch(`${base}/gradio_api/upload?upload_id=${randomUUID()}`, {
    method: "POST",
    headers: authHeaders(token),
    body: form,
    signal,
  });
  if (!res.ok) throw await readError(res, "reference audio upload");

  const paths = await res.json().catch(() => null);
  const path = Array.isArray(paths) ? paths[0] : null;
  if (!path) throw new Error("OmniVoice: Space returned no path for the uploaded reference audio");
  return { path, meta: { _type: "gradio.FileData" } };
}

/**
 * Decode caller-supplied reference audio. Only inline bytes are accepted — a URL would
 * make the router fetch an arbitrary host on behalf of whoever holds an API key, so
 * callers inline the sample instead.
 */
export function decodeReferenceAudio(refAudio) {
  const raw = String(refAudio || "").trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) {
    throw new Error("OmniVoice: reference_audio must be base64 or a data: URI, not a URL");
  }

  const base64 = raw.startsWith("data:") ? raw.replace(/^data:[^;]*;base64,/, "") : raw;
  let buffer;
  try {
    buffer = Buffer.from(base64, "base64");
  } catch {
    throw new Error("OmniVoice: reference_audio is not valid base64");
  }
  if (!buffer.length) throw new Error("OmniVoice: reference_audio is not valid base64");
  if (buffer.length > MAX_REF_AUDIO_BYTES) {
    throw new Error(`OmniVoice: reference_audio exceeds ${Math.round(MAX_REF_AUDIO_BYTES / 1024 / 1024)}MB`);
  }
  return buffer;
}

async function callSpace(base, token, fn, data, signal) {
  const submit = await fetch(`${base}/gradio_api/call/${fn}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders(token) },
    body: JSON.stringify({ data }),
    signal,
  });
  if (!submit.ok) throw await readError(submit, "submit");

  const { event_id: eventId } = (await submit.json().catch(() => ({}))) || {};
  if (!eventId) throw new Error("OmniVoice: Space returned no event id");

  const stream = await fetch(`${base}/gradio_api/call/${fn}/${eventId}`, { headers: authHeaders(token), signal });
  if (!stream.ok) throw await readError(stream, "result");

  return parseGradioStream(await stream.text());
}

function resolveAudioUrl(base, output) {
  const file = Array.isArray(output) ? output[0] : output;
  if (!file) return null;
  if (typeof file === "string") return file;
  if (file.url) return file.url;
  if (file.path) return `${base}/gradio_api/file=${file.path}`;
  return null;
}

// ── Adapter ─────────────────────────────────────────────────────────────────
export default {
  async synthesize(text, model, credentials, _responseFormat, { language, style, refAudio, refText } = {}) {
    // credentials stay optional: the provider is noAuth, but honour a connection if one
    // is ever attached, the way the self-hosted TTS adapter does.
    const rawBase =
      credentials?.providerSpecificData?.baseUrl ||
      credentials?.baseUrl ||
      process.env.OMNIVOICE_BASE_URL ||
      DEFAULT_BASE_URL;
    // Tolerate a trailing slash or a pasted /gradio_api suffix.
    const base = String(rawBase).trim().replace(/\/+$/, "").replace(/\/gradio_api$/, "");
    const token = credentials?.apiKey || process.env.OMNIVOICE_HF_TOKEN || "";

    const { mode, voice } = parseOmnivoiceModel(model);
    const lang = resolveOmnivoiceLanguage(language);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      let output;
      if (mode === CLONE_MODEL) {
        const buffer = decodeReferenceAudio(refAudio);
        if (!buffer) {
          throw new Error('OmniVoice: model "clone" requires reference_audio (base64 or data: URI) in the request body');
        }
        const ref = await uploadReferenceAudio(base, token, buffer, controller.signal);
        // Positional argument order for /_clone_fn, per GET /gradio_api/info.
        output = await callSpace(base, token, "_clone_fn", [
          text, lang, ref, refText || "", style || null,
          DEFAULTS.steps, DEFAULTS.cfg, DEFAULTS.denoise, DEFAULTS.speed, DEFAULTS.duration,
          DEFAULTS.preprocess, DEFAULTS.postprocess,
        ], controller.signal);
      } else {
        const slots = parseVoiceTokens(voice, style);
        // Positional argument order for /_design_fn, per GET /gradio_api/info.
        output = await callSpace(base, token, "_design_fn", [
          text, lang,
          DEFAULTS.steps, DEFAULTS.cfg, DEFAULTS.denoise, DEFAULTS.speed, DEFAULTS.duration,
          DEFAULTS.preprocess, DEFAULTS.postprocess,
          slots.gender, slots.age, slots.pitch, slots.style, slots.accent, slots.dialect,
        ], controller.signal);
      }

      const audioUrl = resolveAudioUrl(base, output);
      if (!audioUrl) throw new Error(`OmniVoice: no audio in Space response${output?.[1] ? ` (${output[1]})` : ""}`);

      const audio = await fetch(audioUrl, { headers: authHeaders(token), signal: controller.signal });
      if (!audio.ok) throw await readError(audio, "audio download");

      // The Space always returns 24kHz WAV; response_format is not negotiable upstream,
      // so report what actually came back rather than what was asked for.
      return responseToBase64(audio, "wav");
    } catch (err) {
      if (err?.name === "AbortError") {
        throw new Error(`OmniVoice: Space did not respond within ${Math.round(REQUEST_TIMEOUT_MS / 1000)}s`);
      }
      throw err;
    } finally {
      clearTimeout(timeout);
    }
  },
};
