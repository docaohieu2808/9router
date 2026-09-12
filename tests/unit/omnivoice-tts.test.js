// OmniVoice TTS — the Gradio Space protocol (submit → poll SSE → download the file),
// the attribute-token voice scheme, and the clone path's reference-audio upload.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Buffer } from "node:buffer";
import { handleTtsCore } from "../../open-sse/handlers/ttsCore.js";
import { getTtsAdapter } from "../../open-sse/handlers/ttsProviders/index.js";
import {
  parseVoiceTokens, parseOmnivoiceModel, parseGradioStream, decodeReferenceAudio,
} from "../../open-sse/handlers/ttsProviders/omnivoice.js";
import { resolveOmnivoiceLanguage, OMNIVOICE_LANGUAGES } from "../../open-sse/config/omnivoiceLanguages.js";
import { AI_PROVIDERS } from "../../src/shared/constants/providers.js";
import { PROVIDER_MODELS } from "../../open-sse/config/providerModels.js";
import { TTS_PROVIDER_CONFIG } from "../../src/shared/constants/ttsProviders.js";
import { getTtsVoicesForModel } from "../../open-sse/config/ttsModels.js";

const originalFetch = global.fetch;
const AUDIO_BYTES = Buffer.from("RIFF....WAVEfmt ".padEnd(200, "\0"));
const SPACE = "https://k2-fsa-omnivoice.hf.space";

function sse(event, data) {
  return `event: ${event}\ndata: ${typeof data === "string" ? data : JSON.stringify(data)}\n\n`;
}

const AUDIO_FILE = {
  path: "/tmp/gradio/abc/audio.wav",
  url: `${SPACE}/gradio_api/file=/tmp/gradio/abc/audio.wav`,
  meta: { _type: "gradio.FileData" },
};

/** submit → SSE result → audio download, the three calls every synthesis makes. */
function mockSuccessfulSynthesis({ file = AUDIO_FILE } = {}) {
  global.fetch
    .mockResolvedValueOnce(new Response(JSON.stringify({ event_id: "evt-1" }), { status: 200 }))
    .mockResolvedValueOnce(new Response(sse("complete", [file, "Done."]), { status: 200 }))
    .mockResolvedValueOnce(new Response(AUDIO_BYTES, { status: 200, headers: { "Content-Type": "audio/wav" } }));
}

function sentBody(callIndex) {
  return JSON.parse(global.fetch.mock.calls[callIndex][1].body);
}

describe("OmniVoice TTS — voice tokens", () => {
  it("maps attribute tokens onto the Space's design dropdowns", () => {
    expect(parseVoiceTokens("female-young")).toMatchObject({
      gender: "Female / 女", age: "Young Adult / 青年", pitch: "Auto", style: "Auto",
    });
    expect(parseVoiceTokens("male-elderly-low")).toMatchObject({
      gender: "Male / 男", age: "Elderly / 老年", pitch: "Low Pitch / 低音调",
    });
    expect(parseVoiceTokens("female-middle-aged")).toMatchObject({
      gender: "Female / 女", age: "Middle-aged / 中年",
    });
    expect(parseVoiceTokens("male-young-british")).toMatchObject({
      accent: "British Accent / 英国口音",
    });
    expect(parseVoiceTokens("female-sichuan")).toMatchObject({
      dialect: "Sichuan Dialect / 四川话",
    });
  });

  it("defaults every slot to Auto and accepts underscores or spaces", () => {
    expect(parseVoiceTokens("")).toEqual({
      gender: "Auto", age: "Auto", pitch: "Auto", style: "Auto", accent: "Auto", dialect: "Auto",
    });
    expect(parseVoiceTokens("FEMALE_YOUNG")).toMatchObject({ gender: "Female / 女", age: "Young Adult / 青年" });
  });

  it("promotes a whisper style hint but ignores other free-form hints", () => {
    expect(parseVoiceTokens("female", "whisper softly").style).toBe("Whisper / 耳语");
    expect(parseVoiceTokens("female", "sound excited").style).toBe("Auto");
  });

  it("rejects an unknown token instead of silently synthesizing a default voice", () => {
    expect(() => parseVoiceTokens("female-yong")).toThrow(/unknown voice token "yong"/);
  });
});

describe("OmniVoice TTS — model string", () => {
  it("splits an explicit mode from the voice and treats a bare value as a voice", () => {
    expect(parseOmnivoiceModel("design/female-young")).toEqual({ mode: "design", voice: "female-young" });
    expect(parseOmnivoiceModel("clone")).toEqual({ mode: "clone", voice: "" });
    expect(parseOmnivoiceModel("female-young")).toEqual({ mode: "design", voice: "female-young" });
    expect(parseOmnivoiceModel("")).toEqual({ mode: "design", voice: "" });
  });
});

describe("OmniVoice TTS — language hint", () => {
  it("accepts names and ISO codes, falling back to Auto", () => {
    expect(resolveOmnivoiceLanguage("vi")).toBe("Vietnamese");
    expect(resolveOmnivoiceLanguage("vi-VN")).toBe("Vietnamese");
    expect(resolveOmnivoiceLanguage("Vietnamese")).toBe("Vietnamese");
    expect(resolveOmnivoiceLanguage("zh-CN")).toBe("Chinese");
    expect(resolveOmnivoiceLanguage("klingon")).toBe("Auto");
    expect(resolveOmnivoiceLanguage("")).toBe("Auto");
  });

  it("only resolves to values the Space's dropdown actually accepts", () => {
    const known = new Set(OMNIVOICE_LANGUAGES);
    for (const input of ["vi", "en", "ja", "ko", "th", "Chinese", "Yue Chinese"]) {
      const resolved = resolveOmnivoiceLanguage(input);
      expect(resolved === "Auto" || known.has(resolved)).toBe(true);
    }
  });
});

describe("OmniVoice TTS — Gradio stream", () => {
  it("returns the payload of the complete event", () => {
    expect(parseGradioStream(sse("complete", [AUDIO_FILE, "Done."]))).toEqual([AUDIO_FILE, "Done."]);
  });

  it("surfaces an error event — ZeroGPU quota failures arrive this way, not as a non-200", () => {
    const stream = sse("heartbeat", "null") + sse("error", { message: "You have exceeded your GPU quota" });
    expect(() => parseGradioStream(stream)).toThrow(/exceeded your GPU quota/);
  });

  it("fails loudly when the stream ends without a result", () => {
    expect(() => parseGradioStream(sse("heartbeat", "null"))).toThrow(/without a result/);
  });
});

describe("OmniVoice TTS — reference audio", () => {
  it("accepts raw base64 and data URIs", () => {
    const b64 = AUDIO_BYTES.toString("base64");
    expect(decodeReferenceAudio(b64)).toBeInstanceOf(Buffer);
    expect(decodeReferenceAudio(`data:audio/wav;base64,${b64}`).length).toBe(AUDIO_BYTES.length);
    expect(decodeReferenceAudio("")).toBeNull();
  });

  it("refuses a URL — the router must not fetch arbitrary hosts for an API-key holder", () => {
    expect(() => decodeReferenceAudio("http://169.254.169.254/latest/meta-data/")).toThrow(/must be base64/);
    expect(() => decodeReferenceAudio("https://example.com/sample.wav")).toThrow(/must be base64/);
  });
});

describe("OmniVoice TTS — synthesis", () => {
  beforeEach(() => { global.fetch = vi.fn(); });
  afterEach(() => {
    global.fetch = originalFetch;
    delete process.env.OMNIVOICE_BASE_URL;
    delete process.env.OMNIVOICE_HF_TOKEN;
  });

  it("submits the design call, polls the event, and downloads the audio", async () => {
    mockSuccessfulSynthesis();

    const result = await handleTtsCore({
      provider: "omnivoice",
      model: "design/female-young",
      input: "Xin chào",
      language: "vi",
      responseFormat: "json",
    });

    expect(result.success).toBe(true);
    expect(global.fetch).toHaveBeenCalledTimes(3);
    expect(global.fetch.mock.calls[0][0]).toBe(`${SPACE}/gradio_api/call/_design_fn`);
    expect(global.fetch.mock.calls[1][0]).toBe(`${SPACE}/gradio_api/call/_design_fn/evt-1`);
    expect(global.fetch.mock.calls[2][0]).toBe(AUDIO_FILE.url);

    // Positional payload for /_design_fn: text, lang, 7 inference params, 6 attributes.
    const data = sentBody(0).data;
    expect(data).toHaveLength(15);
    expect(data[0]).toBe("Xin chào");
    expect(data[1]).toBe("Vietnamese");
    expect(data.slice(2, 9)).toEqual([32, 2.0, true, 1.0, null, true, true]);
    expect(data.slice(9)).toEqual(["Female / 女", "Young Adult / 青年", "Auto", "Auto", "Auto", "Auto"]);

    const body = await result.response.json();
    expect(body.format).toBe("wav");
    expect(Buffer.from(body.audio, "base64")).toEqual(AUDIO_BYTES);
  });

  it("defaults to Auto language and Auto attributes for a bare model id", async () => {
    mockSuccessfulSynthesis();

    await handleTtsCore({ provider: "omnivoice", model: "design", input: "Hello", responseFormat: "json" });

    const data = sentBody(0).data;
    expect(data[1]).toBe("Auto");
    expect(data.slice(9)).toEqual(["Auto", "Auto", "Auto", "Auto", "Auto", "Auto"]);
  });

  it("uploads the reference audio before calling the clone endpoint", async () => {
    global.fetch
      .mockResolvedValueOnce(new Response(JSON.stringify(["/tmp/gradio/up/reference.wav"]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ event_id: "evt-2" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(sse("complete", [AUDIO_FILE, "Done."]), { status: 200 }))
      .mockResolvedValueOnce(new Response(AUDIO_BYTES, { status: 200, headers: { "Content-Type": "audio/wav" } }));

    const result = await handleTtsCore({
      provider: "omnivoice",
      model: "clone",
      input: "Giọng nhân bản",
      language: "Vietnamese",
      refAudio: AUDIO_BYTES.toString("base64"),
      refText: "mẫu tham chiếu",
      style: "read calmly",
      responseFormat: "json",
    });

    expect(result.success).toBe(true);
    expect(global.fetch.mock.calls[0][0]).toMatch(new RegExp(`^${SPACE}/gradio_api/upload\\?upload_id=`));
    expect(global.fetch.mock.calls[1][0]).toBe(`${SPACE}/gradio_api/call/_clone_fn`);

    // Positional payload for /_clone_fn: text, lang, ref audio, ref text, instruct, params.
    const data = sentBody(1).data;
    expect(data).toHaveLength(12);
    expect(data[1]).toBe("Vietnamese");
    expect(data[2]).toEqual({ path: "/tmp/gradio/up/reference.wav", meta: { _type: "gradio.FileData" } });
    expect(data[3]).toBe("mẫu tham chiếu");
    expect(data[4]).toBe("read calmly");
    expect(data.slice(5)).toEqual([32, 2.0, true, 1.0, null, true, true]);
  });

  it("explains what is missing when clone is asked for without reference audio", async () => {
    const result = await handleTtsCore({ provider: "omnivoice", model: "clone", input: "Hello", responseFormat: "json" });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/requires reference_audio/);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("honours OMNIVOICE_BASE_URL and sends the token when one is configured", async () => {
    process.env.OMNIVOICE_BASE_URL = "https://me-omnivoice.hf.space/";
    process.env.OMNIVOICE_HF_TOKEN = "hf_test";
    mockSuccessfulSynthesis({ file: { path: "/tmp/gradio/abc/audio.wav", meta: { _type: "gradio.FileData" } } });

    await handleTtsCore({ provider: "omnivoice", model: "design", input: "Hello", responseFormat: "json" });

    expect(global.fetch.mock.calls[0][0]).toBe("https://me-omnivoice.hf.space/gradio_api/call/_design_fn");
    expect(global.fetch.mock.calls[0][1].headers.Authorization).toBe("Bearer hf_test");
    // A result carrying only a path is resolved against the configured Space, not the default one.
    expect(global.fetch.mock.calls[2][0]).toBe("https://me-omnivoice.hf.space/gradio_api/file=/tmp/gradio/abc/audio.wav");
  });

  it("reports the upstream status when the Space rejects the submit", async () => {
    global.fetch.mockResolvedValueOnce(new Response(JSON.stringify({ detail: "Space is sleeping" }), { status: 503 }));

    const result = await handleTtsCore({ provider: "omnivoice", model: "design", input: "Hello", responseFormat: "json" });

    expect(result.error).toMatch(/submit failed \(503\).*Space is sleeping/);
  });
});

describe("OmniVoice TTS — wiring", () => {
  it("is registered as a noAuth TTS provider with both modes", () => {
    const provider = AI_PROVIDERS.omnivoice;
    expect(provider).toBeDefined();
    expect(provider.serviceKinds).toContain("tts");
    expect(provider.noAuth).toBe(true);
    expect(provider.ttsConfig.models.map((m) => m.id)).toEqual(["design", "clone"]);
    expect(getTtsAdapter("omnivoice")).toBeTruthy();
  });

  it("exposes design presets to the dashboard and none for clone", () => {
    expect(PROVIDER_MODELS["omnivoice-tts-models"].map((m) => m.id)).toEqual(["design", "clone"]);
    expect(getTtsVoicesForModel("omnivoice", "design").map((v) => v.id)).toContain("female-young");
    expect(getTtsVoicesForModel("omnivoice", "clone")).toEqual([]);
    expect(TTS_PROVIDER_CONFIG.omnivoice.voiceSource).toBe("hardcoded");
  });
});
