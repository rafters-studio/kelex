// The plugin engine's PUBLIC surface -- form-word types only. The match/config
// engine (`matches`, `resolveConfig`) and the join (`controlPaths`) are internal
// and imported directly by the fold, never re-exported here or from the root.
export type {
  Bound,
  Child,
  Composer,
  Config,
  Control,
  Entry,
  Handler,
  Input,
  Match,
  Renderer,
  Setting,
  Variant,
} from "./types";
