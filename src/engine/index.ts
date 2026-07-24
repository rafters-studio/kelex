// The plugin engine's PUBLIC surface. `render` folds a descriptor through a
// renderer. The match/config engine (`matches`, `resolveConfig`) and the join
// (`controlPaths`) are internal and imported directly by the fold, never
// re-exported here or from the root.
export { renderForm, validateRenderer } from "./pipeline";
export { render } from "./render";
export { route } from "./route";
export type { Binding, Issue } from "./route";
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
