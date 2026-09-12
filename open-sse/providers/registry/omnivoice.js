// OmniVoice (k2-fsa / next-gen Kaldi) — voice-cloning TTS covering 600+ languages,
// published as a public Gradio Space: https://huggingface.co/spaces/k2-fsa/OmniVoice
//
// noAuth because the Space is open: no key, no connection, works out of the box. The
// trade-off is that the shared Space runs on community ZeroGPU quota, so a busy router
// should duplicate it (or self-host the model) and set OMNIVOICE_BASE_URL to that copy;
// OMNIVOICE_HF_TOKEN adds a Hugging Face identity when the target Space is private.
//
// Two "models" rather than voices, because the Space exposes two different functions:
//   omnivoice/design[/<voice tokens>] — synthesize a voice from attributes
//                                       (e.g. omnivoice/design/female-young)
//   omnivoice/clone                   — clone the voice in `reference_audio`
export default {
  id: "omnivoice",
  alias: "ov",
  display: {
    name: "OmniVoice",
    icon: "record_voice_over",
    color: "#F59E0B",
    textIcon: "OV",
    website: "https://huggingface.co/spaces/k2-fsa/OmniVoice",
  },
  category: "freeTier",
  authType: "none",
  serviceKinds: ["tts"],
  mediaPriority: 6,
  noAuth: true,
  hasFree: true,
  // Top-level models feed PROVIDER_MODELS (and therefore /v1/models/tts); ttsConfig.models
  // below is what the dashboard's TTS card reads. Both list the same two modes.
  models: [
    { id: "design", name: "Voice Design (attributes)", kind: "tts" },
    { id: "clone", name: "Voice Clone (reference audio)", kind: "tts" },
  ],
  ttsConfig: {
    // Read by the UI and by tooling; the adapter resolves the effective URL itself so
    // OMNIVOICE_BASE_URL can override it without a rebuild.
    baseUrl: "https://k2-fsa-omnivoice.hf.space",
    authType: "none",
    authHeader: "none",
    format: "omnivoice",
    defaultModel: "design",
    models: [
      { id: "design", name: "Voice Design (attributes)", kind: "tts" },
      { id: "clone", name: "Voice Clone (reference audio)", kind: "tts" },
    ],
  },
};
