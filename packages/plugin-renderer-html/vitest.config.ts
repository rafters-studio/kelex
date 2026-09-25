import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Unit tests run against source, not a build: kelex's entry points resolve to
// the host's src/ instead of its dist/.
const kelexSrc = fileURLToPath(new URL("../../src", import.meta.url));

export default defineConfig({
  resolve: {
    alias: [{ find: /^@rafters\/kelex\/(.*)$/, replacement: `${kelexSrc}/$1/index.ts` }],
  },
  test: {
    globals: true,
    environment: "node",
    include: ["test/**/*.{test,spec}.ts"],
    exclude: ["node_modules", "dist"],
  },
});
