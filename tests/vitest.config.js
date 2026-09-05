import { defineConfig } from "vitest/config";
import { resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["**/*.test.js"],
    // Don't scan into git worktrees nested under .claude/ — they carry their
    // own copies of the test files but lack an installed node_modules (open-sse,
    // etc.), which makes provider imports fail during collection.
    exclude: [
      "**/node_modules/**", "**/.claude/**", "**/dist/**",
      // Written for the node:test runner, not vitest — vitest collects them and
      // then reports "No test suite found". Run them with `node --test` instead.
      "auth/saml.test.js",
      "unit/kimchi.test.js",
      "unit/kimchi-strip-reasoning.test.js",
      // Hits real upstream endpoints; fails whenever the network or the free
      // provider is unavailable, so it must not gate the offline suite.
      "unit/*.live.test.js",
      // Imports /cloud/src/**, which only exists in the closed cloud repo.
      "unit/embeddings.cloud.test.js",
    ],
    // Allow many it.concurrent cases (real provider smoke runs ~50 providers in parallel)
    maxConcurrency: 60,
    // Suppress noisy console output from handlers under test
    silent: false,
  },
  resolve: {
    // Use array form so subpath aliases (e.g. "@/lib/db/index.js") resolve correctly.
    alias: [
      { find: /^open-sse\//, replacement: resolve(__dirname, "../open-sse") + "/" },
      { find: "open-sse", replacement: resolve(__dirname, "../open-sse") },
      { find: /^@\//, replacement: resolve(__dirname, "../src") + "/" },
    ],
  },
});
