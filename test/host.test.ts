import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadSettings } from "../src";

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

  it("rejects settings missing a plugin", () => {
    const p = settingsFile(`{ "renderer": "@kelex/plugin-renderer-html" }`);
    expect(() => loadSettings(p)).toThrow(/renderer.*handler.*required/);
  });
});
