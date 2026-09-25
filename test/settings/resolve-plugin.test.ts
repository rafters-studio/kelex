import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadPlugin } from "../../src/settings";
import { exportTarget, factoryOf, resolvePlugin } from "../../src/settings/resolve-plugin";

// A throwaway project with plugin packages installed under node_modules, built
// fresh per test so every package shape is exercised through a real resolve and
// a real import().
let project: string;
beforeEach(() => {
  project = mkdtempSync(join(tmpdir(), "kelex-plugins-"));
  writeFileSync(join(project, "package.json"), `{ "name": "consumer", "private": true }`);
});
afterEach(() => {
  rmSync(project, { recursive: true, force: true });
});

function installPackage(name: string, manifest: object, files: Record<string, string>): void {
  const dir = join(project, "node_modules", name);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "package.json"), JSON.stringify({ name, version: "1.0.0", ...manifest }));
  for (const [file, text] of Object.entries(files)) writeFileSync(join(dir, file), text);
}

// Every fixture factory echoes its options back, so a test sees the call land.
const ESM_FACTORY = "export default (options) => ({ shape: 'esm', options });";

describe("loadPlugin -- the package shapes a third-party plugin ships", () => {
  it("loads an ESM package whose exports map has only an import condition", async () => {
    installPackage(
      "esm-only",
      { type: "module", exports: { ".": { import: "./index.js" } } },
      { "index.js": ESM_FACTORY },
    );
    const plugin = await loadPlugin<{ shape: string; options: unknown }>(
      "esm-only",
      { action: "/x" },
      project,
    );
    expect(plugin).toEqual({ shape: "esm", options: { action: "/x" } });
  });

  it("loads a TypeScript-compiled CommonJS package (exports.default = factory)", async () => {
    installPackage(
      "cjs-tsc",
      { main: "./index.js" },
      {
        "index.js": [
          '"use strict";',
          'Object.defineProperty(exports, "__esModule", { value: true });',
          "exports.default = (options) => ({ shape: 'cjs', options });",
        ].join("\n"),
      },
    );
    const plugin = await loadPlugin<{ shape: string }>("cjs-tsc", undefined, project);
    expect(plugin.shape).toBe("cjs");
  });

  it("loads a package with only a main field", async () => {
    installPackage(
      "main-only",
      { type: "module", main: "./entry.js" },
      { "entry.js": ESM_FACTORY },
    );
    const plugin = await loadPlugin<{ shape: string }>("main-only", undefined, project);
    expect(plugin.shape).toBe("esm");
  });

  it("names the package and keeps the underlying error when it is not installed", async () => {
    const load = loadPlugin("not-installed", undefined, project);
    await expect(load).rejects.toThrow(/cannot resolve plugin "not-installed" from .+: /);
    await expect(load).rejects.toHaveProperty("cause");
  });

  it("names the plugin and keeps the cause when its entry file is missing", async () => {
    installPackage("unbuilt", { type: "module", exports: "./dist/index.js" }, {});
    const load = loadPlugin("unbuilt", undefined, project);
    await expect(load).rejects.toThrow(/cannot load plugin "unbuilt" from .+dist\/index\.js: /);
    await expect(load).rejects.toHaveProperty("cause");
  });

  it("refuses a module whose default export is not a factory", async () => {
    installPackage(
      "not-a-factory",
      { type: "module", exports: "./index.js" },
      { "index.js": "export default { renderer: true };" },
    );
    await expect(loadPlugin("not-a-factory", undefined, project)).rejects.toThrow(
      /must default-export a factory/,
    );
  });
});

describe("resolvePlugin", () => {
  // Checked on the URL resolvePlugin returns, not through import(): vitest's
  // loader forgives an extensionless or directory path that Node rejects.
  const resolved = (name: string) => resolvePlugin(name, project).replace(/^.*node_modules\//, "");

  it("gives main Node's CommonJS lookup: an omitted .js, a directory, or no main", () => {
    installPackage("no-ext", { main: "lib/index" }, {});
    mkdirSync(join(project, "node_modules/no-ext/lib"));
    writeFileSync(join(project, "node_modules/no-ext/lib/index.js"), "");
    installPackage("dir-main", { main: "./dist" }, {});
    mkdirSync(join(project, "node_modules/dir-main/dist"));
    writeFileSync(join(project, "node_modules/dir-main/dist/index.js"), "");
    installPackage("no-main", {}, { "index.js": "" });

    expect(resolved("no-ext")).toBe("no-ext/lib/index.js");
    expect(resolved("dir-main")).toBe("dir-main/dist/index.js");
    expect(resolved("no-main")).toBe("no-main/index.js");
  });

  it("names the plugin when main points at nothing", () => {
    installPackage("bad-main", { main: "./missing.js" }, {});
    expect(() => resolvePlugin("bad-main", project)).toThrow(
      /plugin "bad-main" has no loadable main/,
    );
  });

  it("refuses a path or a subpath instead of a package name", () => {
    for (const name of ["./local-renderer.mjs", "/abs/renderer.js", "pkg/sub", "C:\\r.js"]) {
      expect(() => resolvePlugin(name, project), name).toThrow(/must be a package name/);
    }
  });

  it("accepts plain and scoped package names", () => {
    installPackage("@scope/plugin", { main: "./index.js" }, { "index.js": "" });
    expect(resolved("@scope/plugin")).toBe("@scope/plugin/index.js");
  });
});

describe("exportTarget", () => {
  it("reads a string, a subpath map, nested conditions, and an array", () => {
    expect(exportTarget("./a.js")).toBe("./a.js");
    expect(exportTarget({ ".": "./b.js", "./extra": "./c.js" })).toBe("./b.js");
    expect(exportTarget({ ".": { types: "./d.d.ts", import: "./d.js" } })).toBe("./d.js");
    expect(exportTarget({ node: { import: "./e.mjs" }, default: "./e.cjs" })).toBe("./e.mjs");
    expect(exportTarget([{ browser: "./x.js" }, "./f.js"])).toBe("./f.js");
  });

  it("takes the first active condition in the package's own key order, as Node does", () => {
    expect(exportTarget({ node: "./node.js", import: "./import.js" })).toBe("./node.js");
    expect(exportTarget({ default: "./default.js", node: "./node.js" })).toBe("./default.js");
  });

  it("falls back to require only when no active condition applies", () => {
    expect(exportTarget({ require: "./r.cjs", default: "./d.js" })).toBe("./d.js");
    expect(exportTarget({ require: "./r.cjs" })).toBe("./r.cjs");
  });

  it("returns undefined when no condition kelex honors applies", () => {
    expect(exportTarget({ ".": { browser: "./x.js" } })).toBeUndefined();
  });
});

describe("factoryOf", () => {
  const factory = () => ({});
  it("takes a function default as is, and unwraps one CommonJS default level", () => {
    expect(factoryOf({ default: factory })).toBe(factory);
    expect(factoryOf({ default: { default: factory } })).toBe(factory);
  });
});
