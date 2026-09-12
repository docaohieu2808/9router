// The 503 "all accounts rate limited" response is the one error whose body AND headers are the
// payload — a browser client needs both to render a countdown. Without CORS headers the browser
// discards the response entirely and the app can only report a generic network failure.
import { describe, it, expect } from "vitest";
import { unavailableResponse, errorResponse } from "../../open-sse/utils/error.js";

describe("unavailableResponse CORS", () => {
  const retryAt = () => new Date(Date.now() + 45_000).toISOString();

  it("is readable cross-origin, like every other error response", () => {
    const res = unavailableResponse(503, "[omnivoice/design] Quota exhausted", retryAt(), "reset after 45s");

    expect(res.status).toBe(503);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(errorResponse(400, "x").headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("exposes Retry-After — it is not a CORS-safelisted response header", () => {
    const res = unavailableResponse(429, "rate limited", retryAt(), "reset after 45s");

    expect(Number(res.headers.get("Retry-After"))).toBeGreaterThan(0);
    expect(res.headers.get("Access-Control-Expose-Headers")).toMatch(/Retry-After/i);
  });

  it("still carries the human-readable retry text in the body", async () => {
    const res = unavailableResponse(503, "[el/tts] Unavailable", retryAt(), "reset after 45s");

    expect((await res.json()).error.message).toBe("[el/tts] Unavailable (reset after 45s)");
  });
});
