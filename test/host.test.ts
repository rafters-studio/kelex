import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { z } from "zod/v4";
import { generateForm, loadSettings } from "../src";
import type { KelexSettings } from "../src";

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "kelex-settings-"));
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

function settingsFile(text: string): string {
  const p = join(dir, "kelex.settings.jsonc");
  writeFileSync(p, text);
  return p;
}

describe("loadSettings", () => {
  it("requires only the plugins; parses jsonc (comments + trailing commas)", () => {
    const loaded = loadSettings(
      settingsFile(`{
        // the only required settings: which plugins to load
        "renderer": "@kelex/plugin-renderer-html",
        "handler": "@kelex/plugin-handler-post", // trailing comma is fine:
      }`),
    );
    expect(loaded.renderer).toBe("@kelex/plugin-renderer-html");
    expect(loaded.handler).toBe("@kelex/plugin-handler-post");
  });

  it("reads a file saved with a UTF-8 byte-order mark", () => {
    const p = settingsFile(`﻿{ "renderer": "r", "handler": "h" }`);
    expect(loadSettings(p).renderer).toBe("r");
  });

  it("names the first parse error and where it is", () => {
    const p = settingsFile(`{\n  "renderer": "r"\n  "handler": "h"\n}`);
    expect(() => loadSettings(p)).toThrow(/CommaExpected at line 3, column 3/);
  });

  it("loads settings that name only a renderer (#252)", () => {
    const loaded = loadSettings(settingsFile(`{ "renderer": "@kelex/plugin-renderer-html" }`));
    expect(loaded).toEqual({ renderer: "@kelex/plugin-renderer-html" });
  });

  it("names the missing renderer, not both keys, when neither is given (#252)", () => {
    const p = settingsFile(`{ "renderer.options": { "action": "/x" } }`);
    expect(() => loadSettings(p)).toThrow(/"renderer" must name a plugin package; it is missing$/);
  });

  it("refuses an unknown key instead of ignoring it (#252)", () => {
    const p = settingsFile(`{ "renderer": "r", "rendrer.options": {} }`);
    expect(() => loadSettings(p)).toThrow(/unknown key "rendrer.options"/);
  });

  it("checks settings passed as an object the same way as a file (#252)", async () => {
    const schema = z.object({ a: z.string() });
    const load = generateForm(schema, { settings: { handler: "h" } as unknown as KelexSettings });
    await expect(load).rejects.toThrow(
      /settings: "renderer" must name a plugin package; it is missing/,
    );
  });

  it("names the key whose value has the wrong type (#252)", () => {
    const cases: [string, RegExp][] = [
      [`{ "renderer": 5 }`, /"renderer" must name a plugin package; got 5/],
      [`{ "renderer": "  " }`, /"renderer" must name a plugin package; got "  "/],
      [`{ "renderer": "r", "handler": false }`, /"handler" must name a plugin package; got false/],
      [`{ "renderer": "r", "renderer.options": [] }`, /"renderer.options" must be an object/],
      [`{ "renderer": "r", "handler.options": "x" }`, /"handler.options" must be an object/],
    ];
    for (const [text, message] of cases) {
      expect(() => loadSettings(settingsFile(text)), text).toThrow(message);
    }
  });
});
