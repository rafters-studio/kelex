import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Unit tests run against source, not a build: kelex's entry points resolve to
// the host's src/, and the renderer the tests pair with resolves to its src/.
const kelexSrc = fileURLToPath(new URL("../../src", import.meta.url));
const rendererSrc = fileURLToPath(
  new URL("../plugin-renderer-html/src/renderer.ts", import.meta.url),
);

export default defineConfig({
  resolve: {
    alias: [
      { find: /^kelex\/(.*)$/, replacement: `${kelexSrc}/$1/index.ts` },
      { find: /^@kelex\/plugin-renderer-html$/, replacement: rendererSrc },
    ],
  },
  test: {
    globals: true,
    environment: "node",
    include: ["test/**/*.{test,spec}.ts"],
    exclude: ["node_modules", "dist"],
  },
});
