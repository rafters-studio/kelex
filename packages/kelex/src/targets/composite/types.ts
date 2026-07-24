import type { TargetOptions } from "../types";

export interface CompositeOptions extends TargetOptions {
  /** Indent size for JSON output. Defaults to 2. */
  indent?: number;
}
