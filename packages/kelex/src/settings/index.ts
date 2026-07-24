import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { type ParseError, parse as parseJsonc } from "jsonc-parser";
import { renderForm } from "../engine";
import type { Handler, Renderer } from "../engine/types";
import { introspect } from "../introspection";
import type { KelexSettings, PluginFactory } from "./types";

/** Read and validate `kelex.settings.jsonc` (comments + trailing commas allowed). */
export function loadSettings(configPath: string): KelexSettings {
  const raw = readFileSync(resolve(configPath), "utf8");
  const errors: ParseError[] = [];
  const parsed = parseJsonc(raw, errors, {
    allowTrailingComma: true,
    disallowComments: false,
  }) as KelexSettings | undefined;
  if (errors.length > 0) {
    throw new Error(`invalid ${configPath}: ${errors.length} JSONC parse error(s)`);
  }
  if (!parsed || typeof parsed !== "object") {
    throw new Error(`invalid ${configPath}: expected a settings object`);
  }
  if (!parsed.renderer) throw new Error(`${configPath}: "renderer" (a plugin package) is required`);
  if (!parsed.schema || !parsed.export) {
    throw new Error(`${configPath}: "schema" and "export" are required`);
  }
  if (!parsed.out) throw new Error(`${configPath}: "out" (output path) is required`);
  return parsed;
}

/**
 * The plugin load contract: import the named package and call its default-exported
 * factory with the plugin's options. A plugin that does not default-export a
 * factory is a hard error — the host cannot use it.
 */
async function loadPlugin<T>(
  pkg: string,
  options: Record<string, unknown> | undefined,
  from: string,
): Promise<T> {
  // Resolve the plugin from the PROJECT (where the consumer installed it),
  // not from kelex's own node_modules -- the host doesn't depend on any
  // particular plugin, it loads whatever the settings name.
  const require = createRequire(pathToFileURL(resolve(from, "package.json")).href);
  let resolved: string;
  try {
    resolved = require.resolve(pkg);
  } catch {
    throw new Error(`cannot resolve plugin "${pkg}" from ${from} — is it installed?`);
  }
  const mod = (await import(pathToFileURL(resolved).href)) as {
    default?: unknown;
    plugin?: unknown;
  };
  const factory = (mod.default ?? mod.plugin) as PluginFactory<T> | undefined;
  if (typeof factory !== "function") {
    throw new Error(`plugin "${pkg}" must default-export a factory: (options) => plugin`);
  }
  return factory(options);
}

export interface FormResult {
  output: string;
  fields: string[];
}

/**
 * Run the pipeline described by the settings: import the schema, introspect it,
 * load the declared renderer (and handler) plugins, and fold the form. This is
 * the host — kelex loads whatever plugins the settings name, exactly like any
 * plugin system reads its config and loads the plugins declared there.
 */
export async function generateForm(
  settings: KelexSettings,
  from: string = process.cwd(),
): Promise<FormResult> {
  const schemaUrl = pathToFileURL(resolve(settings.schema)).href;
  const mod = (await import(schemaUrl)) as Record<string, unknown> & { default?: unknown };
  const schema = mod[settings.export] ?? mod.default;
  if (!schema || !(schema as { _zod?: unknown })._zod) {
    throw new Error(
      `"${settings.export}" is not a Zod schema in ${settings.schema} (need zod >= 4)`,
    );
  }

  const descriptor = introspect(schema as Parameters<typeof introspect>[0], {
    formName: settings.formName ?? settings.export,
    schemaImportPath: settings.schema,
    schemaExportName: settings.export,
  });

  const renderer = await loadPlugin<Renderer<unknown>>(
    settings.renderer,
    settings["renderer.options"],
    from,
  );
  const handler = settings.handler
    ? await loadPlugin<Handler<unknown>>(settings.handler, settings["handler.options"], from)
    : undefined;

  const output = renderForm(descriptor, renderer, handler);
  return { output: String(output), fields: descriptor.fields.map((f) => f.name) };
}

/** Write a generated form to the settings' `out` path, creating parent dirs. */
export function writeForm(outPath: string, output: string): void {
  const target = resolve(outPath);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, output, "utf8");
}
