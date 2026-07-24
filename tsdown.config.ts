import { defineConfig } from "tsdown";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    cli: "src/cli.ts",
    engine: "src/engine/index.ts",
    introspection: "src/introspection/index.ts",
    conformance: "src/conformance/index.ts",
    targets: "src/targets/index.ts",
    "schema-writer": "src/schema-writer/index.ts",
  },
  format: ["esm"],
  fixedExtension: false,
  dts: true,
  clean: true,
});
