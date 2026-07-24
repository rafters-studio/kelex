/**
 * The `kelex.settings.jsonc` shape — the host config. It declares which plugins
 * to load and how kelex runs a form, like any plugin system's config file.
 */
export interface KelexSettings {
  /** Renderer plugin package to import + load, e.g. "@kelex/plugin-renderer-html". */
  renderer: string;
  /** Handler plugin package to import + load. Omit for inert (unwired) markup. */
  handler?: string;
  /** Path to the schema module (imported and evaluated at run time). */
  schema: string;
  /** The exported schema name in that module. */
  export: string;
  /** Where to write the generated form. */
  out: string;
  /** Form name (metadata). Defaults to the export name. */
  formName?: string;
  /** Options forwarded to the renderer plugin's factory. */
  "renderer.options"?: Record<string, unknown>;
  /** Options forwarded to the handler plugin's factory. */
  "handler.options"?: Record<string, unknown>;
}

/**
 * The plugin load contract: a plugin package DEFAULT-exports a factory that takes
 * its options and returns the renderer/handler. The host imports the package
 * named in the settings and calls this.
 */
export type PluginFactory<T> = (options?: Record<string, unknown>) => T;
