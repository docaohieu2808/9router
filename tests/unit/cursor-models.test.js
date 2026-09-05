import { EventEmitter } from "node:events";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// cursorModels.js speaks raw HTTP/2 (agent.api5.cursor.sh is h2-only and undici
// cannot do h2), so there is no fetch to stub — the http2 module itself is the
// seam. `h2` records what the client sent so the request can be asserted.
const h2 = vi.hoisted(() => ({ connects: [], requests: [], reply: null }));

vi.mock("http2", () => {
  const connect = vi.fn((authority) => {
    h2.connects.push(authority);
    const client = new EventEmitter();
    client.close = vi.fn();
    client.request = vi.fn((headers) => {
      const req = new EventEmitter();
      const record = { authority, headers, body: null };
      h2.requests.push(record);
      req.end = (body) => {
        record.body = body;
        // Reply on a later tick so the caller can attach its listeners first.
        setImmediate(() => {
          const { status, payload } = h2.reply || { status: 200, payload: new Uint8Array() };
          req.emit("response", { ":status": String(status) });
          if (payload?.length) req.emit("data", Buffer.from(payload));
          req.emit("end");
        });
      };
      return req;
    });
    return client;
  });
  return { default: { connect }, connect };
});
import {
  clearCursorModelCache,
  parseCursorUsableModels,
  resolveCursorModels,
} from "../../open-sse/services/cursorModels.js";

function varint(value) {
  const bytes = [];
  while (value >= 0x80) {
    bytes.push((value & 0x7f) | 0x80);
    value >>>= 7;
  }
  bytes.push(value);
  return Uint8Array.from(bytes);
}

function field(fieldNumber, value) {
  return Uint8Array.from([(fieldNumber << 3) | 2, ...varint(value.length), ...value]);
}

function text(value) {
  return new TextEncoder().encode(value);
}

function concat(...parts) {
  const size = parts.reduce((sum, part) => sum + part.length, 0);
  const result = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

function model(id, name) {
  return field(1, concat(field(1, text(id)), field(4, text(name))));
}

describe("Cursor live model catalog", () => {
  beforeEach(() => {
    clearCursorModelCache();
    h2.connects.length = 0;
    h2.requests.length = 0;
    h2.reply = null;
  });

  afterEach(() => {
    clearCursorModelCache();
  });

  it("decodes the GetUsableModels protobuf response", () => {
    const payload = concat(
      model("default", "Auto"),
      model("gpt-5.3-codex", "GPT 5.3 Codex"),
      model("gpt-5.3-codex", "Duplicate"),
    );

    expect(parseCursorUsableModels(payload)).toEqual([
      { id: "default", name: "Auto" },
      { id: "gpt-5.3-codex", name: "GPT 5.3 Codex" },
    ]);
  });

  it("fetches the account-specific catalog and caches it", async () => {
    h2.reply = { status: 200, payload: concat(model("claude-4.6-opus", "Claude 4.6 Opus")) };
    const credentials = {
      accessToken: "cursor-token",
      providerSpecificData: { machineId: "machine-id" },
    };

    await expect(resolveCursorModels(credentials)).resolves.toEqual({
      models: [{ id: "claude-4.6-opus", name: "Claude 4.6 Opus" }],
    });
    // Second call must come off the cache, not the wire.
    await expect(resolveCursorModels(credentials)).resolves.toEqual({
      models: [{ id: "claude-4.6-opus", name: "Claude 4.6 Opus" }],
    });

    expect(h2.requests).toHaveLength(1);
    expect(h2.connects[0]).toBe("https://agent.api5.cursor.sh");
    expect(h2.requests[0].headers).toEqual(expect.objectContaining({
      ":method": "POST",
      ":path": "/agent.v1.AgentService/GetUsableModels",
      ":authority": "agent.api5.cursor.sh",
      ":scheme": "https",
      "content-type": "application/proto",
      accept: "application/proto",
    }));
  });

  it("fails open when the Cursor catalog request fails", async () => {
    h2.reply = { status: 403, payload: new TextEncoder().encode("no") };

    await expect(resolveCursorModels({
      accessToken: "cursor-token",
      providerSpecificData: { machineId: "machine-id" },
    })).resolves.toBeNull();
  });
});
