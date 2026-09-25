import { readFileSync } from "node:fs";
import { findPackageJSON } from "node:module";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

// The export conditions an ESM `import()` honors, in the order kelex tries them.
// `require` comes last: `import()` loads CommonJS too, so a require-only
// package still loads.
const CONDITIONS = ["import", "node", "default", "require"] as const;

/**
 * Pick the file an `exports` value points at for an `import()`: a string is the
 * target; an array is tried in order; an object is either a subpath map (keys
 * start with ".", so take ".") or a condition map (take the first condition
 * kelex honors). Returns undefined when nothing applies.
 */
export function exportTarget(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    for (const item of value) {
      const target = exportTarget(item);
      if (target !== undefined) return target;
    }
    return undefined;
  }
  if (typeof value !== "object" || value === null) return undefined;
  const map = value as Record<string, unknown>;
  if (Object.keys(map).some((k) => k.startsWith("."))) return exportTarget(map["."]);
  for (const condition of CONDITIONS) {
    if (condition in map) {
      const target = exportTarget(map[condition]);
      if (target !== undefined) return target;
    }
  }
  return undefined;
}

/**
 * Resolve a plugin package name to the file URL `import()` should load, looking
 * in the `node_modules` above `from` the way Node does. Unlike `require.resolve`,
 * this honors an ESM-only `exports` map (an "import" condition with no
 * "require" or "default").
 */
export function resolvePlugin(pkg: string, from: string): string {
  let manifestPath: string | undefined;
  try {
    manifestPath = findPackageJSON(pkg, pathToFileURL(join(resolve(from), "_")).href);
  } catch (error) {
    throw new Error(`cannot resolve plugin "${pkg}" from ${from}: ${messageOf(error)}`, {
      cause: error,
    });
  }
  if (manifestPath === undefined) {
    throw new Error(`cannot resolve plugin "${pkg}" from ${from}: no package.json found`);
  }
  const manifest: unknown = JSON.parse(readFileSync(manifestPath, "utf8"));
  const fields = typeof manifest === "object" && manifest !== null ? manifest : {};
  const target =
    "exports" in fields
      ? exportTarget(fields.exports)
      : "main" in fields && typeof fields.main === "string"
        ? fields.main
        : "index.js";
  if (target === undefined) {
    throw new Error(`plugin "${pkg}" exports no "." entry that import() can load`);
  }
  return pathToFileURL(join(dirname(manifestPath), target)).href;
}

/**
 * The factory a plugin module default-exports. A TypeScript-compiled CommonJS
 * module (`exports.default = factory`) arrives through `import()` as
 * `{ default: { default: factory } }`, so one level is unwrapped.
 */
export function factoryOf(mod: { default?: unknown }): unknown {
  const first = mod.default;
  if (typeof first === "function") return first;
  if (typeof first === "object" && first !== null && "default" in first) return first.default;
  return first;
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
