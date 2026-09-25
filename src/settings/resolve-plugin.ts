import { readFileSync } from "node:fs";
import { createRequire, findPackageJSON } from "node:module";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

// The conditions active for a Node `import()`. As in Node, a condition map is
// read in the package's own key order and the first active key wins.
const ACTIVE: ReadonlySet<string> = new Set(["import", "node", "default"]);
// Only if the whole map yields nothing under those does kelex search it again
// with `require` active too. Node's `import()` would stop there, but it loads
// CommonJS, so kelex lets a require-only package load. This is the one place
// kelex is looser than Node.
const WITH_REQUIRE: ReadonlySet<string> = new Set([...ACTIVE, "require"]);

// A package name: `name` or `@scope/name`, with no subpath and no file path.
const PACKAGE_NAME = /^(?:@[^/\\\s]+\/)?[^/\\\s.][^/\\\s]*$/;

/**
 * Pick the file an `exports` value points at for an `import()`. Resolves the
 * whole tree with the `import()` conditions first, and only if that finds
 * nothing, again with `require` active. Returns undefined when nothing applies.
 */
export function exportTarget(value: unknown): string | undefined {
  return pick(value, ACTIVE) ?? pick(value, WITH_REQUIRE);
}

// A string is the target; an array is tried in order; an object is a subpath
// map (keys start with ".", so take ".") or a condition map, read in key order.
function pick(value: unknown, active: ReadonlySet<string>): string | undefined {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    for (const item of value) {
      const target = pick(item, active);
      if (target !== undefined) return target;
    }
    return undefined;
  }
  if (typeof value !== "object" || value === null) return undefined;
  const map = value as Record<string, unknown>;
  const keys = Object.keys(map);
  if (keys.some((k) => k.startsWith("."))) return pick(map["."], active);
  for (const key of keys) {
    if (!active.has(key)) continue;
    const target = pick(map[key], active);
    if (target !== undefined) return target;
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
  if (!PACKAGE_NAME.test(pkg)) {
    throw new Error(`plugin "${pkg}" must be a package name (name or @scope/name), not a path`);
  }
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
  if ("exports" in fields) {
    const target = exportTarget(fields.exports);
    if (target === undefined) {
      throw new Error(`plugin "${pkg}" exports no "." entry that import() can load`);
    }
    // An exports target is an exact file, as Node requires.
    return pathToFileURL(join(dirname(manifestPath), target)).href;
  }
  // `main` predates exports and gets Node's CommonJS lookup: an omitted ".js",
  // a directory holding index.js, or index.js when there is no main at all.
  const main = "main" in fields && typeof fields.main === "string" ? fields.main : undefined;
  try {
    return pathToFileURL(createRequire(manifestPath).resolve(`./${main ?? "."}`)).href;
  } catch (error) {
    const what = main === undefined ? "no main, no exports, and no index.js" : `main "${main}"`;
    throw new Error(`plugin "${pkg}" has nothing to load (${what}): ${messageOf(error)}`, {
      cause: error,
    });
  }
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

export function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
