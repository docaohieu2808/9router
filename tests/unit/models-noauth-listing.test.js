// noAuth providers are callable by anyone (/v1/audio/speech skips credentials for them), so a
// models listing that only walks provider connections hides exactly the free voices. A client
// that builds its UI from /v1/models/tts would offer none of them.
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  getProviderConnections: vi.fn(),
  getCombos: vi.fn(),
  getCustomModels: vi.fn(),
  getModelAliases: vi.fn(),
  getDisabledModels: vi.fn(),
}));

vi.mock("@/lib/localDb", () => ({
  getProviderConnections: mocks.getProviderConnections,
  getCombos: mocks.getCombos,
  getCustomModels: mocks.getCustomModels,
  getModelAliases: mocks.getModelAliases,
  getAllowedConnectionIdsForKey: async () => null,
  getProviderNodes: vi.fn(async () => []),
}));

vi.mock("@/lib/disabledModelsDb", () => ({ getDisabledModels: mocks.getDisabledModels }));
vi.mock("@/sse/services/tokenRefresh", () => ({ updateProviderCredentials: vi.fn() }));

const { buildModelsList } = await import("../../src/app/api/v1/models/route.js");

describe("/v1/models/{kind} lists noAuth providers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCombos.mockResolvedValue([]);
    mocks.getCustomModels.mockResolvedValue([]);
    mocks.getModelAliases.mockResolvedValue({});
    mocks.getDisabledModels.mockResolvedValue({});
    // A router with at least one credentialed connection — the case where the
    // per-connection loop runs and used to be the only source of models.
    mocks.getProviderConnections.mockResolvedValue([
      { id: "c1", provider: "elevenlabs", isActive: true, apiKey: "k" },
    ]);
  });

  it("includes edge-tts voices even though no connection exists for it", async () => {
    const ids = (await buildModelsList(["tts"])).map((m) => m.id);

    expect(ids.some((id) => id.startsWith("edge-tts/"))).toBe(true);
    expect(ids).toContain("edge-tts/vi-VN-HoaiMyNeural");
  });

  it("includes both OmniVoice modes", async () => {
    const ids = (await buildModelsList(["tts"])).map((m) => m.id);

    expect(ids).toContain("ov/design");
    expect(ids).toContain("ov/clone");
  });

  it("still lists the connected provider's models", async () => {
    const ids = (await buildModelsList(["tts"])).map((m) => m.id);

    expect(ids.some((id) => id.startsWith("el/"))).toBe(true);
  });

  it("does not leak noAuth TTS models into the chat listing", async () => {
    const ids = (await buildModelsList(["llm"])).map((m) => m.id);

    expect(ids.some((id) => id.startsWith("edge-tts/"))).toBe(false);
    expect(ids).not.toContain("ov/design");
  });

  it("honours a disabled-model list for noAuth providers too", async () => {
    mocks.getDisabledModels.mockResolvedValue({ "edge-tts": ["vi-VN-HoaiMyNeural"] });

    const ids = (await buildModelsList(["tts"])).map((m) => m.id);

    expect(ids).not.toContain("edge-tts/vi-VN-HoaiMyNeural");
    expect(ids.some((id) => id.startsWith("edge-tts/"))).toBe(true);
  });
});
