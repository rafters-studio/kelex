/**
 * `kelex.settings.jsonc` — the host config. It declares ONLY which plugins to
 * import and load; everything else (the schema, output, per-run options) is
 * runtime. Like any plugin system, the config is "what plugins", not "what work".
 */
export interface KelexSettings {
  /** Renderer plugin package to import + load, e.g. "@rafters/kelex-renderer-html". */
  renderer: string;
  /**
   * Handler plugin package to import + load, e.g. "@rafters/kelex-handler-post".
   * Optional: without one the form is the renderer's markup, unwired.
   */
  handler?: string;
  /** Default options for the renderer plugin (a run can override them). */
  "renderer.options"?: Record<string, unknown>;
  /** Default options for the handler plugin (a run can override them). */
  "handler.options"?: Record<string, unknown>;
}

/**
 * The plugin load contract: a plugin package DEFAULT-exports a factory that takes
 * its options and returns the renderer/handler. The host imports the package
 * named in the settings and calls this.
 */
export type PluginFactory<T> = (options?: Record<string, unknown>) => T | Promise<T>;

/** Per-run options passed to `generateForm` at call time — not baked in settings. */
export interface GenerateOptions {
  /**
   * Settings file to load. Defaults to `kelex.settings.jsonc` in the cwd —
   * `generateForm` loads it itself, so you never have to.
   */
  config?: string;
  /** Pass settings directly instead of loading a file (skips `config`). */
  settings?: KelexSettings;
  /** Form name (metadata). */
  formName?: string;
  /** Options merged over the settings' `renderer.options` for this run. */
  rendererOptions?: Record<string, unknown>;
  /** Options merged over the settings' `handler.options` for this run. */
  handlerOptions?: Record<string, unknown>;
  /**
   * Directory to resolve the plugin packages from. Defaults to the directory of
   * the settings file, or to `process.cwd()` when `settings` is passed directly.
   */
  from?: string;
}
