import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";

// Mock next/server so the route's responses are plain inspectable objects.
vi.mock("next/server", () => ({
  NextResponse: {
    json: vi.fn((body, init) => ({
      status: init?.status || 200,
      body,
      json: async () => body,
    })),
  },
}));

// homedir() drives every candidate path, so pointing it at a scratch directory
// is enough to exercise the real probing + better-sqlite3 read. The route
// resolves better-sqlite3 through a runtime require(), which vi.mock cannot
// intercept — so this suite builds a genuine state.vscdb instead of mocking it.
const fakeHome = fs.mkdtempSync(path.join(os.tmpdir(), "9router-cursor-home-"));
vi.mock("os", async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, default: { ...actual.default, homedir: () => fakeHomeRef.value }, homedir: () => fakeHomeRef.value };
});
const fakeHomeRef = vi.hoisted(() => ({ value: "" }));
fakeHomeRef.value = fakeHome;

// Keep the sqlite3 CLI strategy failing so the fallbacks stay deterministic.
vi.mock("child_process", () => ({
  execFile: vi.fn((cmd, args, opts, cb) => {
    const done = typeof opts === "function" ? opts : cb;
    done(new Error("ENOENT"));
  }),
}));

const DB_REL = "Library/Application Support/Cursor/User/globalStorage/state.vscdb";
const dbPath = path.join(fakeHome, DB_REL);

function writeDb(rows) {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  fs.rmSync(dbPath, { force: true });
  const db = new Database(dbPath);
  db.exec("CREATE TABLE itemTable (key TEXT PRIMARY KEY, value TEXT)");
  const insert = db.prepare("INSERT INTO itemTable (key, value) VALUES (?, ?)");
  for (const [k, v] of Object.entries(rows)) insert.run(k, v);
  db.close();
}

function removeDb() {
  fs.rmSync(path.join(fakeHome, "Library"), { recursive: true, force: true });
}

let GET;

describe("GET /api/oauth/cursor/auto-import", () => {
  const originalPlatform = process.platform;

  beforeAll(async () => {
    Object.defineProperty(process, "platform", { value: "darwin", writable: true });
    ({ GET } = await import("../../src/app/api/oauth/cursor/auto-import/route.js"));
  });

  afterAll(() => {
    Object.defineProperty(process, "platform", { value: originalPlatform, writable: true });
    fs.rmSync(fakeHome, { recursive: true, force: true });
  });

  beforeEach(() => {
    Object.defineProperty(process, "platform", { value: "darwin", writable: true });
    removeDb();
  });

  afterEach(() => vi.clearAllMocks());

  // ── Path probing ──────────────────────────────────────────────────────

  it("returns not-found listing every candidate when none is accessible", async () => {
    const response = await GET();

    expect(response.body.found).toBe(false);
    expect(response.body.error).toContain("Cursor database not found. Checked locations:");
    expect(response.body.error).toContain("Cursor - Insiders");
  });

  it("answers 200, not 400, on a platform with no candidate list", async () => {
    Object.defineProperty(process, "platform", { value: "freebsd", writable: true });

    const response = await GET();

    expect(response.status).toBe(200);
    expect(response.body.found).toBe(false);
  });

  // ── Token extraction against a real state.vscdb ───────────────────────

  it("extracts tokens using exact keys", async () => {
    writeDb({
      "cursorAuth/accessToken": "test-token",
      "storage.serviceMachineId": "test-machine-id",
    });

    const response = await GET();

    expect(response.body.found).toBe(true);
    expect(response.body.accessToken).toBe("test-token");
    expect(response.body.machineId).toBe("test-machine-id");
  });

  it("falls back to the secondary access-token key", async () => {
    writeDb({
      "cursorAuth/token": "secondary-token",
      "storage.serviceMachineId": "test-machine-id",
    });

    const response = await GET();

    expect(response.body.found).toBe(true);
    expect(response.body.accessToken).toBe("secondary-token");
  });

  it("unwraps JSON-encoded string values", async () => {
    writeDb({
      "cursorAuth/accessToken": '"json-token"',
      "storage.serviceMachineId": '"json-machine-id"',
    });

    const response = await GET();

    expect(response.body.found).toBe(true);
    expect(response.body.accessToken).toBe("json-token");
    expect(response.body.machineId).toBe("json-machine-id");
  });

  // ── Fallback ──────────────────────────────────────────────────────────

  it("asks for a manual paste when the db opens but holds no tokens", async () => {
    writeDb({});

    const response = await GET();

    expect(response.body.found).toBe(false);
    expect(response.body.windowsManual).toBe(true);
    expect(response.body.dbPath).toBe(dbPath);
  });

  it("refuses to import on linux when Cursor itself is not installed", async () => {
    Object.defineProperty(process, "platform", { value: "linux", writable: true });
    const linuxDb = path.join(fakeHome, ".config/Cursor/User/globalStorage/state.vscdb");
    fs.mkdirSync(path.dirname(linuxDb), { recursive: true });
    fs.writeFileSync(linuxDb, "");

    const response = await GET();

    // `which cursor` is mocked to fail and no cursor.desktop exists under the
    // scratch home, so the route must refuse rather than read leftover config.
    expect(response.body.found).toBe(false);
    expect(response.body.error).toContain("does not appear to be installed");
  });
});
