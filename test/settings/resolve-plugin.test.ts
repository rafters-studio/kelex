import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { z } from "zod/v4";
import { generateForm, loadPlugin } from "../../src/settings";
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

describe("loadPlugin -- a factory's result must fit the role it fills (#259)", () => {
  const factoryReturning = (name: string, value: string) =>
    installPackage(
      name,
      { type: "module", main: "./index.js" },
      {
        "index.js": `export default () => (${value});`,
      },
    );

  it("names the package and the first missing renderer member", async () => {
    factoryReturning("half-renderer", "{ inventory: [], compose: {} }");
    await expect(loadPlugin("half-renderer", undefined, project, "renderer")).rejects.toThrow(
      'plugin "half-renderer" returned a renderer without a function "form"; it is missing',
    );
  });

  it("names a mistyped renderer member and what it got", async () => {
    factoryReturning("bad-inventory", "{ inventory: {}, compose: {}, form() {}, fallback() {} }");
    await expect(loadPlugin("bad-inventory", undefined, project, "renderer")).rejects.toThrow(
      'plugin "bad-inventory" returned a renderer without an array "inventory"; got an object',
    );
  });

  it("refuses a renderer factory that returns a function, not an object", async () => {
    factoryReturning("fn-renderer", "() => {}");
    await expect(loadPlugin("fn-renderer", undefined, project, "renderer")).rejects.toThrow(
      'plugin "fn-renderer" returned a function, not a renderer object',
    );
  });

  it("names a handler without wire", async () => {
    factoryReturning("empty-handler", "{}");
    await expect(loadPlugin("empty-handler", undefined, project, "handler")).rejects.toThrow(
      'plugin "empty-handler" returned a handler without a function "wire"; it is missing',
    );
  });

  it("fails in generateForm itself, before the engine runs", async () => {
    factoryReturning("half-renderer", "{ inventory: [], compose: {} }");
    const run = generateForm(z.object({ a: z.string() }), {
      settings: { renderer: "half-renderer" },
      from: project,
    });
    await expect(run).rejects.toThrow('plugin "half-renderer" returned a renderer without');
  });

  it("refuses a Map for compose, whose entries the engine cannot read by key", async () => {
    factoryReturning(
      "map-compose",
      "{ inventory: [], compose: new Map(), form() {}, fallback() {} }",
    );
    await expect(loadPlugin("map-compose", undefined, project, "renderer")).rejects.toThrow(
      'plugin "map-compose" returned a renderer without an object "compose"; got a Map',
    );
  });

  it("names null and arrays as themselves, not as object", async () => {
    factoryReturning("null-compose", "{ inventory: [], compose: null, form() {}, fallback() {} }");
    await expect(loadPlugin("null-compose", undefined, project, "renderer")).rejects.toThrow(
      'without an object "compose"; got null',
    );
    factoryReturning("array-compose", "{ inventory: [], compose: [], form() {}, fallback() {} }");
    await expect(loadPlugin("array-compose", undefined, project, "renderer")).rejects.toThrow(
      'without an object "compose"; got an array',
    );
  });

  it("refuses a Promise or a WeakMap for compose, and says to await a Promise", async () => {
    factoryReturning(
      "promise-compose",
      "{ inventory: [], compose: Promise.resolve({}), form() {}, fallback() {} }",
    );
    await expect(loadPlugin("promise-compose", undefined, project, "renderer")).rejects.toThrow(
      'without an object "compose"; got a Promise (await it in the factory)',
    );
    factoryReturning(
      "weak-compose",
      "{ inventory: [], compose: new WeakMap(), form() {}, fallback() {} }",
    );
    await expect(loadPlugin("weak-compose", undefined, project, "renderer")).rejects.toThrow(
      'without an object "compose"; got a WeakMap',
    );
  });

  it("refuses a WeakSet for compose (#269)", async () => {
    factoryReturning(
      "weakset-compose",
      "{ inventory: [], compose: new WeakSet(), form() {}, fallback() {} }",
    );
    await expect(loadPlugin("weakset-compose", undefined, project, "renderer")).rejects.toThrow(
      'without an object "compose"; got a WeakSet',
    );
  });

  it("accepts a compose with a composer named then, which is not a Promise (#269)", async () => {
    factoryReturning(
      "then-compose",
      "{ inventory: [], compose: { then() {}, field() {} }, form() {}, fallback() {} }",
    );
    const renderer = await loadPlugin<{ compose: Record<string, unknown> }>(
      "then-compose",
      undefined,
      project,
      "renderer",
    );
    expect(typeof renderer.compose.then).toBe("function");
  });

  it("says undefined, not an undefined, when a factory returns nothing", async () => {
    factoryReturning("empty-return", "undefined");
    await expect(loadPlugin("empty-return", undefined, project, "renderer")).rejects.toThrow(
      'plugin "empty-return" returned undefined, not a renderer object',
    );
  });

  it("accepts compose as a class instance or a null-prototype object", async () => {
    factoryReturning(
      "class-compose",
      "{ inventory: [], compose: new (class { field() {} })(), form() {}, fallback() {} }",
    );
    factoryReturning(
      "bare-compose",
      "{ inventory: [], compose: Object.create(null), form() {}, fallback() {} }",
    );
    for (const name of ["class-compose", "bare-compose"]) {
      const renderer = await loadPlugin<{ compose: unknown }>(name, undefined, project, "renderer");
      expect(typeof renderer.compose).toBe("object");
    }
  });

  it("names the plugin when its factory throws or rejects", async () => {
    installPackage(
      "throwing",
      { type: "module", main: "./index.js" },
      {
        "index.js": "export default () => { throw new Error('boom'); };",
      },
    );
    installPackage(
      "rejecting",
      { type: "module", main: "./index.js" },
      {
        "index.js": "export default async () => { throw new Error('later boom'); };",
      },
    );
    const sync = loadPlugin("throwing", undefined, project, "renderer");
    await expect(sync).rejects.toThrow('plugin "throwing" factory failed: boom');
    await expect(sync).rejects.toHaveProperty("cause");
    await expect(loadPlugin("rejecting", undefined, project, "renderer")).rejects.toThrow(
      'plugin "rejecting" factory failed: later boom',
    );
  });

  it("awaits an async factory before checking what it returns", async () => {
    installPackage(
      "async-handler",
      { type: "module", main: "./index.js" },
      {
        "index.js": "export default async () => ({ wire: (form) => form });",
      },
    );
    const handler = await loadPlugin<{ wire: unknown }>(
      "async-handler",
      undefined,
      project,
      "handler",
    );
    expect(typeof handler.wire).toBe("function");
  });

  it("accepts a result with every member its role needs", async () => {
    factoryReturning("ok-handler", "{ wire: (form) => form }");
    const handler = await loadPlugin<{ wire: unknown }>(
      "ok-handler",
      undefined,
      project,
      "handler",
    );
    expect(typeof handler.wire).toBe("function");
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

  it("names the plugin and what it looked for when there is nothing to load", () => {
    installPackage("bad-main", { main: "./missing.js" }, {});
    installPackage("empty", {}, {});
    expect(() => resolvePlugin("bad-main", project)).toThrow(
      /plugin "bad-main" has nothing to load \(main "\.\/missing\.js"\)/,
    );
    expect(() => resolvePlugin("empty", project)).toThrow(
      /plugin "empty" has nothing to load \(no main, no exports, and no index\.js\)/,
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

  it("tries require only after the whole map yields nothing for import()", () => {
    // Node's import() resolves this to ./d.mjs: the nested node map has no
    // active key, so resolution continues to the outer default.
    const nested = { ".": { node: { require: "./n.cjs" }, default: "./d.mjs" } };
    expect(exportTarget(nested)).toBe("./d.mjs");
    // With no import() target anywhere, a require-only package still loads.
    expect(exportTarget({ ".": { require: "./r.cjs" } })).toBe("./r.cjs");
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
