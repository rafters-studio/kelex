import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { type ParseError, parse as parseJsonc, printParseErrorCode } from "jsonc-parser";
import { renderForm } from "../engine";
import type { Handler, Renderer } from "../engine/types";
import { introspect } from "../introspection";
import { factoryOf, messageOf, resolvePlugin } from "./resolve-plugin";
import type { GenerateOptions, KelexSettings } from "./types";

const DEFAULT_SETTINGS = "kelex.settings.jsonc";

/** Read and validate `kelex.settings.jsonc` — ONLY the plugins to load. */
export function loadSettings(configPath = DEFAULT_SETTINGS): KelexSettings {
  // Some editors save UTF-8 with a byte-order mark, which JSONC reports as an error.
  const raw = readFileSync(resolve(configPath), "utf8").replace(/^﻿/, "");
  const errors: ParseError[] = [];
  const parsed: unknown = parseJsonc(raw, errors, {
    allowTrailingComma: true,
    disallowComments: false,
  });
  const [first] = errors;
  if (first) {
    const before = raw.slice(0, first.offset).split("\n");
    const where = `line ${before.length}, column ${(before.at(-1)?.length ?? 0) + 1}`;
    throw new Error(
      `invalid ${configPath}: ${printParseErrorCode(first.error)} at ${where}` +
        (errors.length > 1 ? ` (and ${errors.length - 1} more)` : ""),
    );
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`invalid ${configPath}: expected a settings object`);
  }
  return checkSettings(parsed as Record<string, unknown>, configPath);
}

// The settings name the plugins and their options, and nothing else.
const SETTINGS_KEYS = new Set(["renderer", "handler", "renderer.options", "handler.options"]);

/**
 * Check the parsed settings key by key and name the first problem. `renderer`
 * is required; `handler` is optional (no handler leaves the form unwired); each
 * present key must have its type; an unknown key, usually a typo, is refused
 * rather than silently ignored.
 */
export function checkSettings(raw: Record<string, unknown>, configPath: string): KelexSettings {
  const unknown = Object.keys(raw).find((key) => !SETTINGS_KEYS.has(key));
  if (unknown !== undefined) {
    throw new Error(
      `${configPath}: unknown key "${unknown}"; settings hold only ${[...SETTINGS_KEYS].join(", ")}`,
    );
  }
  const packageName = (key: string, required: boolean): string | undefined => {
    const value = raw[key];
    if (value === undefined && !required) return undefined;
    if (typeof value !== "string" || value.trim() === "") {
      const found = value === undefined ? "it is missing" : `got ${JSON.stringify(value)}`;
      throw new Error(`${configPath}: "${key}" must name a plugin package; ${found}`);
    }
    return value;
  };
  const options = (key: string): Record<string, unknown> | undefined => {
    const value = raw[key];
    if (value === undefined) return undefined;
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      throw new Error(`${configPath}: "${key}" must be an object of plugin options`);
    }
    return value as Record<string, unknown>;
  };

  const settings: KelexSettings = { renderer: packageName("renderer", true) as string };
  const handler = packageName("handler", false);
  if (handler !== undefined) settings.handler = handler;
  const rendererOptions = options("renderer.options");
  if (rendererOptions) settings["renderer.options"] = rendererOptions;
  const handlerOptions = options("handler.options");
  if (handlerOptions) settings["handler.options"] = handlerOptions;
  return settings;
}

type MemberKind = "array" | "object" | "function";

// The members each plugin role must have, checked in this order (#259).
const PLUGIN_SHAPES = {
  renderer: [
    ["inventory", "array"],
    ["compose", "object"],
    ["form", "function"],
    ["fallback", "function"],
  ],
  handler: [["wire", "function"]],
} as const satisfies Record<string, readonly (readonly [string, MemberKind])[]>;

export type PluginRole = keyof typeof PLUGIN_SHAPES;

// A plain object: the engine reads members by key, so a Map or a class instance
// with the right entries still fails there.
const isPlainObject = (value: unknown): boolean => {
  if (typeof value !== "object" || value === null) return false;
  const proto: unknown = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
};

const isKind = (value: unknown, kind: MemberKind): boolean =>
  kind === "array"
    ? Array.isArray(value)
    : kind === "object"
      ? isPlainObject(value)
      : typeof value === "function";

/** What a value is, in words: null and arrays are named, not reported as "object". */
const describe = (value: unknown): string =>
  value === null
    ? "null"
    : Array.isArray(value)
      ? "an array"
      : value instanceof Map
        ? "a Map"
        : typeof value;

/** What is wrong with a factory's result for its role, or undefined if nothing. */
function shapeProblem(plugin: unknown, role: PluginRole): string | undefined {
  if (typeof plugin !== "object" || plugin === null) {
    return `returned ${describe(plugin)}, not a ${role} object`;
  }
  const members = plugin as Record<string, unknown>;
  for (const [key, kind] of PLUGIN_SHAPES[role]) {
    if (!isKind(members[key], kind)) {
      const found = members[key] === undefined ? "it is missing" : `got ${describe(members[key])}`;
      const wanted =
        kind === "function" ? "a function" : kind === "array" ? "an array" : "a plain object";
      return `returned a ${role} without ${wanted} "${key}"; ${found}`;
    }
  }
  return undefined;
}

/**
 * The plugin load contract: resolve the named package from the PROJECT (where the
 * consumer installed it — the host depends on no particular plugin), import it,
 * and call its default-exported factory with the merged options. Given a role,
 * the factory's result is checked for that role's members, so a wrong shape
 * fails here naming the package, not later inside the engine.
 */
export async function loadPlugin<T>(
  pkg: string,
  options: Record<string, unknown> | undefined,
  from: string,
  role?: PluginRole,
): Promise<T> {
  const url = resolvePlugin(pkg, from);
  let mod: { default?: unknown };
  try {
    mod = await import(url);
  } catch (error) {
    throw new Error(`cannot load plugin "${pkg}" from ${url}: ${messageOf(error)}`, {
      cause: error,
    });
  }
  const factory = factoryOf(mod);
  if (typeof factory !== "function") {
    throw new Error(`plugin "${pkg}" must default-export a factory: (options) => plugin`);
  }
  // A factory may be async; await it so its result, not a Promise, is checked.
  const plugin: unknown = await (factory as (options?: Record<string, unknown>) => unknown)(
    options,
  );
  const problem = role ? shapeProblem(plugin, role) : undefined;
  if (problem) throw new Error(`plugin "${pkg}" ${problem}`);
  return plugin as T;
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
  const configPath = options.config ?? DEFAULT_SETTINGS;
  // Settings passed as an object get the same checks as a file.
  const settings = options.settings
    ? checkSettings({ ...options.settings }, "settings")
    : loadSettings(configPath);
  // Plugins are installed next to the settings file that names them. Settings
  // passed as an object have no file, so they resolve from the working directory.
  const from = options.from ?? (options.settings ? process.cwd() : dirname(resolve(configPath)));
  const descriptor = introspect(schema, {
    formName: options.formName ?? "Form",
    schemaImportPath: "./schema",
    schemaExportName: "schema",
  });

  const renderer = await loadPlugin<Renderer<unknown>>(
    settings.renderer,
    merge(settings["renderer.options"], options.rendererOptions),
    from,
    "renderer",
  );
  // No handler named: the renderer's output is the form, unwired.
  const handler = settings.handler
    ? await loadPlugin<Handler<unknown>>(
        settings.handler,
        merge(settings["handler.options"], options.handlerOptions),
        from,
        "handler",
      )
    : undefined;

  const output = renderForm(descriptor, renderer, handler);
  return { output: String(output), fields: descriptor.fields.map((f) => f.name) };
}

/** Write a generated form to `outPath`, creating parent dirs. */
export function writeForm(outPath: string, output: string): void {
  const target = resolve(outPath);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, output, "utf8");
}
