import { rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { generateForm, loadSettings } from "kelex";
import type { KelexSettings } from "kelex";

const schemaPath = join(import.meta.dirname, "fixtures", "signup.ts");

describe("kelex host — config-driven plugin loading", () => {
  it("loadSettings parses jsonc (comments + trailing commas)", () => {
    const p = join(tmpdir(), `kelex-settings-${process.pid}.jsonc`);
    writeFileSync(
      p,
      `{
        // the plugins to import + load
        "renderer": "@kelex/plugin-renderer-html",
        "handler": "@kelex/plugin-handler-post",
        "schema": "./schema.ts",
        "export": "s",
        "out": "out.html", // trailing comma is fine:
      }`,
    );
    const settings = loadSettings(p);
    expect(settings.renderer).toBe("@kelex/plugin-renderer-html");
    expect(settings.handler).toBe("@kelex/plugin-handler-post");
    rmSync(p);
  });

  it("generateForm imports + loads the declared plugins and folds a wired form", async () => {
    const settings: KelexSettings = {
      renderer: "@kelex/plugin-renderer-html",
      handler: "@kelex/plugin-handler-post",
      schema: schemaPath,
      export: "signupSchema",
      out: "unused.html",
      "renderer.options": { action: "/api/signup" },
    };
    const { output, fields } = await generateForm(settings);
    // The renderer plugin produced classless HTML with the action from options.
    expect(output.startsWith("<form")).toBe(true);
    expect(output).toContain('action="/api/signup"');
    expect(output).not.toMatch(/\sclass=/);
    // The handler plugin wired it.
    expect(output).toContain("<script>");
    // The schema's fields are stamped by path.
    expect(output).toContain('name="email"');
    expect(output).toContain('name="acceptTerms"');
    expect(fields).toEqual(["email", "displayName", "plan", "acceptTerms"]);
  });

  it("runs renderer-only when no handler is declared (inert markup)", async () => {
    const settings: KelexSettings = {
      renderer: "@kelex/plugin-renderer-html",
      schema: schemaPath,
      export: "signupSchema",
      out: "unused.html",
    };
    const { output } = await generateForm(settings);
    expect(output.startsWith("<form")).toBe(true);
    expect(output).not.toContain("<script>"); // no handler -> no wiring
  });
});
