// The shared catalog from @rafters/toolchain. Config dependencies install into
// node_modules/.pnpm-config, where a bare "@rafters/toolchain" import does not resolve.
export { hooks } from "./node_modules/.pnpm-config/@rafters/toolchain/pnpmfile.mjs";
