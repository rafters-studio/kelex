import type { TargetOptions } from "../types";

export interface ReactTanStackOptions extends TargetOptions {
  /** UI component import path. When omitted, generates built-in primitives. */
  uiImportPath?: string;
}
