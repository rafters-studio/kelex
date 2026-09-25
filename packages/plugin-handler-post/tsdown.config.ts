import { defineConfig } from "tsdown";

export default defineConfig({
  entry: { index: "src/handler.ts" },
  format: ["esm"],
  fixedExtension: false,
  dts: true,
  clean: true,
});
