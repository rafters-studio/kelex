// kelex's host entry: load a `kelex.settings.jsonc`, resolve + load the plugins
// it names, and generate a form. This is NOT a re-export barrel of the whole
// package — the engine contract, introspection, conformance, and targets are
// their own entry points (`kelex/engine`, `kelex/introspection`, ...).
export { generateForm, loadSettings, writeForm } from "./settings";
export type { FormResult } from "./settings";
export type { GenerateOptions, KelexSettings, PluginFactory } from "./settings/types";
