import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { type ParseError, parse as parseJsonc } from "jsonc-parser";
import { renderForm } from "../engine";
import type { Handler, Renderer } from "../engine/types";
import { introspect } from "../introspection";
import type { GenerateOptions, KelexSettings, PluginFactory } from "./types";

/** Read and validate `kelex.settings.jsonc` — ONLY the plugins to load. */
export function loadSettings(configPath = "kelex.settings.jsonc"): KelexSettings {
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
  if (!parsed.renderer || !parsed.handler) {
    throw new Error(`${configPath}: "renderer" and "handler" (plugin packages) are required`);
  }
  return parsed;
}

/**
 * The plugin load contract: resolve the named package from the PROJECT (where the
 * consumer installed it — the host depends on no particular plugin), import it,
 * and call its default-exported factory with the merged options.
 */
async function loadPlugin<T>(
  pkg: string,
  options: Record<string, unknown> | undefined,
  from: string,
): Promise<T> {
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

const merge = (
  base: Record<string, unknown> | undefined,
  over: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined => (base || over ? { ...base, ...over } : undefined);

/**
 * Run the pipeline: load the settings (from `kelex.settings.jsonc` unless you
 * override), introspect the LIVE schema, load the renderer + handler plugins the
 * settings name, and fold the form. You pass the schema and any per-run options;
 * kelex loads the settings and the plugins itself, like any plugin system.
 */
export async function generateForm(
  schema: Parameters<typeof introspect>[0],
  options: GenerateOptions = {},
): Promise<FormResult> {
  const settings = options.settings ?? loadSettings(options.config);
  const from = options.from ?? process.cwd();
  const descriptor = introspect(schema, {
    formName: options.formName ?? "Form",
    schemaImportPath: "./schema",
    schemaExportName: "schema",
  });

  const renderer = await loadPlugin<Renderer<unknown>>(
    settings.renderer,
    merge(settings["renderer.options"], options.rendererOptions),
    from,
  );
  const handler = await loadPlugin<Handler<unknown>>(
    settings.handler,
    merge(settings["handler.options"], options.handlerOptions),
    from,
  );

  const output = renderForm(descriptor, renderer, handler);
  return { output: String(output), fields: descriptor.fields.map((f) => f.name) };
}

/** Write a generated form to `outPath`, creating parent dirs. */
export function writeForm(outPath: string, output: string): void {
  const target = resolve(outPath);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, output, "utf8");
}
