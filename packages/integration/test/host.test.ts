import { rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { z } from "zod/v4";
import { generateForm, loadSettings } from "kelex";
import type { KelexSettings } from "kelex";

// A live schema — the programmatic surface takes the schema object, not a path.
const signupSchema = z.object({
  email: z.email(),
  displayName: z.string().min(2).max(40),
  plan: z.enum(["free", "pro", "team"]),
  acceptTerms: z.boolean(),
});

const settings: KelexSettings = {
  renderer: "@kelex/plugin-renderer-html",
  handler: "@kelex/plugin-handler-post",
};

describe("kelex host — config-driven plugin loading", () => {
  it("loadSettings requires only the plugins; parses jsonc (comments + trailing commas)", () => {
    const p = join(tmpdir(), `kelex-settings-${process.pid}.jsonc`);
    writeFileSync(
      p,
      `{
        // the only required settings: which plugins to load
        "renderer": "@kelex/plugin-renderer-html",
        "handler": "@kelex/plugin-handler-post", // trailing comma is fine:
      }`,
    );
    const loaded = loadSettings(p);
    expect(loaded.renderer).toBe("@kelex/plugin-renderer-html");
    expect(loaded.handler).toBe("@kelex/plugin-handler-post");
    rmSync(p);
  });

  it("rejects settings missing a plugin", () => {
    const p = join(tmpdir(), `kelex-bad-${process.pid}.jsonc`);
    writeFileSync(p, `{ "renderer": "@kelex/plugin-renderer-html" }`);
    expect(() => loadSettings(p)).toThrow(/renderer.*handler.*required/);
    rmSync(p);
  });

  it("generateForm takes a LIVE schema + run options and folds a wired form", async () => {
    const { output, fields } = await generateForm(signupSchema, {
      settings, // or omit -> loads kelex.settings.jsonc itself
      rendererOptions: { action: "/api/signup" }, // a run-time option, not baked in settings
    });
    // The renderer plugin produced classless HTML with the run's action.
    expect(output.startsWith("<form")).toBe(true);
    expect(output).toContain('action="/api/signup"');
    expect(output).not.toMatch(/\sclass=/);
    // The handler plugin wired it, and every field is stamped by path.
    expect(output).toContain("<script>");
    expect(output).toContain('name="email"');
    expect(output).toContain('name="acceptTerms"');
    expect(fields).toEqual(["email", "displayName", "plan", "acceptTerms"]);
  });

  it("a run overrides the settings' plugin options", async () => {
    const withDefault: KelexSettings = { ...settings, "renderer.options": { action: "/default" } };
    const { output } = await generateForm(signupSchema, {
      settings: withDefault,
      rendererOptions: { action: "/override" },
    });
    expect(output).toContain('action="/override"');
    expect(output).not.toContain('action="/default"');
  });

  it("loads settings from a config file when none is passed", async () => {
    const p = join(tmpdir(), `kelex-cfg-${process.pid}.jsonc`);
    writeFileSync(
      p,
      `{ "renderer": "@kelex/plugin-renderer-html", "handler": "@kelex/plugin-handler-post" }`,
    );
    const { output } = await generateForm(signupSchema, { config: p });
    expect(output.startsWith("<form")).toBe(true);
    expect(output).toContain("<script>"); // handler from the loaded config
    rmSync(p);
  });
});
