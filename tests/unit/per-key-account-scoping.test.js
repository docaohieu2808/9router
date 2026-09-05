// Per-key account scoping: an endpoint API key may be restricted to a subset of
// provider connections. Fork-local feature (upstream PR #3661), so it carries
// its own coverage rather than relying on the suites that merely mock it.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";

const originalDataDir = process.env.DATA_DIR;
let tempDir;
let db;

async function connection(provider, email) {
  return db.createProviderConnection({
    provider,
    authType: "oauth",
    email,
    name: email,
    data: { accessToken: "t" },
    isActive: true,
  });
}

beforeAll(async () => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "9router-scoping-"));
  process.env.DATA_DIR = tempDir;
  vi.resetModules();
  db = await import("@/lib/db/index.js");
  await db.initDb();
});

afterAll(() => {
  if (tempDir) fs.rmSync(tempDir, { recursive: true, force: true });
  if (originalDataDir === undefined) delete process.env.DATA_DIR;
  else process.env.DATA_DIR = originalDataDir;
});

describe("per-key account scoping", () => {
  let key;
  let agA;
  let agB;
  let codex;

  beforeEach(async () => {
    key = await db.createApiKey(`key-${Math.random().toString(36).slice(2)}`, "machine-1");
    agA = await connection("antigravity", `a-${Math.random().toString(36).slice(2)}@x.com`);
    agB = await connection("antigravity", `b-${Math.random().toString(36).slice(2)}@x.com`);
    codex = await connection("codex", `c-${Math.random().toString(36).slice(2)}@x.com`);
  });

  it("treats a key with no assignments as unrestricted", async () => {
    // Back-compat: keys created before the feature existed must keep full access.
    expect(await db.getAllowedConnectionIdsForKey(key.key)).toBeNull();
  });

  it("resolves an assigned key to exactly its connection set", async () => {
    await db.setKeyAccounts(key.id, [agA.id, agB.id]);

    const allowed = await db.getAllowedConnectionIdsForKey(key.key);
    expect(allowed).toBeInstanceOf(Set);
    expect([...allowed].sort()).toEqual([agA.id, agB.id].sort());
    expect(allowed.has(codex.id)).toBe(false);
  });

  it("de-duplicates the assignment list", async () => {
    const stored = await db.setKeyAccounts(key.id, [agA.id, agA.id, agB.id]);
    expect(stored).toHaveLength(2);
    expect(await db.getKeyAccounts(key.id)).toHaveLength(2);
  });

  it("clears assignments back to unrestricted with an empty list", async () => {
    await db.setKeyAccounts(key.id, [agA.id]);
    expect(await db.getAllowedConnectionIdsForKey(key.key)).toBeInstanceOf(Set);

    await db.setKeyAccounts(key.id, []);
    expect(await db.getAllowedConnectionIdsForKey(key.key)).toBeNull();
  });

  it("does not resolve an unknown key string", async () => {
    expect(await db.getAllowedConnectionIdsForKey("sk-not-a-real-key")).toBeNull();
  });

  it("does not resolve a deactivated key even when it has assignments", async () => {
    await db.setKeyAccounts(key.id, [agA.id]);
    await db.updateApiKey(key.id, { isActive: false });
    expect(await db.getAllowedConnectionIdsForKey(key.key)).toBeNull();
  });

  it("drops the assignment when the connection is deleted", async () => {
    await db.setKeyAccounts(key.id, [agA.id, agB.id]);
    await db.deleteProviderConnection(agA.id);

    const allowed = await db.getAllowedConnectionIdsForKey(key.key);
    expect([...allowed]).toEqual([agB.id]);
  });

  it("reports which providers a scoped key may reach", async () => {
    const { isProviderAllowedForKey } = await import("@/sse/services/auth.js");
    await db.setKeyAccounts(key.id, [agA.id]);
    const allowed = await db.getAllowedConnectionIdsForKey(key.key);

    expect(await isProviderAllowedForKey("antigravity", allowed)).toBe(true);
    // Refusing a provider the key was never given is a permission answer, not an
    // outage — the handler turns this into 403 rather than "no credentials".
    expect(await isProviderAllowedForKey("codex", allowed)).toBe(false);
  });

  it("lets an unrestricted key reach every provider", async () => {
    const { isProviderAllowedForKey } = await import("@/sse/services/auth.js");
    expect(await isProviderAllowedForKey("codex", null)).toBe(true);
  });

  it("drops the assignments when the key itself is deleted", async () => {
    await db.setKeyAccounts(key.id, [agA.id]);
    await db.deleteApiKey(key.id);
    expect(await db.getKeyAccounts(key.id)).toEqual([]);
  });
});
