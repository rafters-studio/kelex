import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod/v4";
import { generateForm } from "../src";
import type { KelexSettings } from "../src";

// Integration: generateForm resolves the real default plugin packages by name,
// which load from their built dist/. Run after `pnpm build`.

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

// The repo root, where the default plugins are installed as workspace packages.
const ROOT = resolve(__dirname, "..");

let dir: string | undefined;
afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
  dir = undefined;
});

describe("kelex host — generateForm with the default plugins", () => {
  it("takes a LIVE schema + run options and folds a wired form", async () => {
    const { output, fields } = await generateForm(signupSchema, {
      settings, // or omit -> loads kelex.settings.jsonc itself
      rendererOptions: { action: "/api/signup" }, // a run-time option, not baked in settings
      from: ROOT,
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
      from: ROOT,
    });
    expect(output).toContain('action="/override"');
    expect(output).not.toContain('action="/default"');
  });

  it("resolves plugins next to the settings file when no from is given", async () => {
    // The plugins exist only in the temp project, never under the working
    // directory, so the load succeeds only if resolution starts at the settings.
    dir = mkdtempSync(join(tmpdir(), "kelex-from-"));
    const rendererDist = pathToFileURL(
      join(ROOT, "packages/plugin-renderer-html/dist/index.js"),
    ).href;
    const install = (name: string, source: string) => {
      const pkgDir = join(dir as string, "node_modules", name);
      mkdirSync(pkgDir, { recursive: true });
      writeFileSync(join(pkgDir, "package.json"), JSON.stringify({ name, type: "module" }));
      writeFileSync(join(pkgDir, "index.js"), source);
    };
    install("local-renderer", `export { default } from "${rendererDist}";`);
    install("local-handler", `export default () => ({ wire: (form) => form + "<!-- local -->" });`);
    const p = join(dir, "kelex.settings.jsonc");
    writeFileSync(p, `{ "renderer": "local-renderer", "handler": "local-handler" }`);

    expect(process.cwd()).not.toBe(dir);
    const { output } = await generateForm(signupSchema, { config: p });
    expect(output.endsWith("<!-- local -->")).toBe(true);
  });

  it("loads settings from a config file when none is passed", async () => {
    dir = mkdtempSync(join(tmpdir(), "kelex-host-"));
    const p = join(dir, "kelex.settings.jsonc");
    writeFileSync(
      p,
      `{ "renderer": "@kelex/plugin-renderer-html", "handler": "@kelex/plugin-handler-post" }`,
    );
    const { output } = await generateForm(signupSchema, { config: p, from: ROOT });
    expect(output.startsWith("<form")).toBe(true);
    expect(output).toContain("<script>"); // handler from the loaded config
  });
});
