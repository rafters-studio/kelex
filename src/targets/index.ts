// Types

export type { CompositeOptions } from "./composite";
export { compositeTarget } from "./composite";
export type { ReactTanStackOptions } from "./react-tanstack";
// Built-in targets
export { reactTanStackTarget } from "./react-tanstack";
// Registry
export { listTargets, registerTarget, resolveTarget } from "./registry";
export type {
  CodegenTarget,
  TargetOptions,
  TargetOutputFile,
  TargetResult,
} from "./types";
