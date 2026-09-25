import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { pathToFileURL } from "node:url";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { version as packageVersion } from "../package.json";

const CLI_PATH = path.resolve(__dirname, "../dist/cli.js");
const FIXTURES_PATH = path.resolve(__dirname, "fixtures");
const TEST_OUTPUT_DIR = path.resolve(__dirname, "fixtures/output");

function runCli(args: string[], cwd?: string): string {
  return execFileSync("node", [CLI_PATH, ...args], { encoding: "utf-8", cwd });
}

function runCliWithError(args: string[]): { stdout: string; stderr: string } {
  try {
    const stdout = execFileSync("node", [CLI_PATH, ...args], {
      encoding: "utf-8",
      stdio: "pipe",
    });
    return { stdout, stderr: "" };
  } catch (error: unknown) {
    const execError = error as { stdout?: string; stderr?: string };
    return {
      stdout: execError.stdout ?? "",
      stderr: execError.stderr ?? "",
    };
  }
}

describe("CLI", () => {
  beforeAll(() => {
    // Ensure dist exists
    if (!fs.existsSync(CLI_PATH)) {
      throw new Error("CLI not built. Run `pnpm build` first.");
    }
  });

  afterEach(() => {
    // Clean up test output files
    if (fs.existsSync(TEST_OUTPUT_DIR)) {
      fs.rmSync(TEST_OUTPUT_DIR, { recursive: true });
    }
  });

  describe("generate command", () => {
    it("generates a composite descriptor from a schema file", () => {
      const schemaPath = path.join(FIXTURES_PATH, "user-schema.ts");
      const outputPath = path.join(TEST_OUTPUT_DIR, "user.composite.json");

      const result = runCli(["generate", schemaPath, "-o", outputPath, "-s", "userSchema"]);

      expect(result).toContain("Generated");
      expect(result).toContain("9 fields");
      expect(fs.existsSync(outputPath)).toBe(true);

      const descriptor = JSON.parse(fs.readFileSync(outputPath, "utf-8"));
      expect(descriptor.name).toBe("UserForm");
      expect(descriptor.schemaExportName).toBe("userSchema");
      expect(descriptor.fields).toHaveLength(9);
    });

    it("derives output path from schema path", () => {
      const schemaPath = path.join(FIXTURES_PATH, "user-schema.ts");

      // Run without -o option
      const result = runCli(["generate", schemaPath, "-s", "userSchema"]);

      expect(result).toContain("Generated");

      // Should create user-form.composite.json in fixtures dir
      const expectedOutput = path.join(FIXTURES_PATH, "user-form.composite.json");
      expect(fs.existsSync(expectedOutput)).toBe(true);

      // Clean up
      fs.rmSync(expectedOutput);
    });

    it("uses custom form name", () => {
      const schemaPath = path.join(FIXTURES_PATH, "user-schema.ts");
      const outputPath = path.join(TEST_OUTPUT_DIR, "custom.composite.json");

      runCli([
        "generate",
        schemaPath,
        "-o",
        outputPath,
        "-s",
        "userSchema",
        "-n",
        "CustomUserForm",
      ]);

      const descriptor = JSON.parse(fs.readFileSync(outputPath, "utf-8"));
      expect(descriptor.name).toBe("CustomUserForm");
    });

    it("shows error for non-existent file", () => {
      const { stderr } = runCliWithError(["generate", "/nonexistent/schema.ts"]);
      expect(stderr).toContain("Schema file not found");
    });

    it("shows error for missing schema export", () => {
      const schemaPath = path.join(FIXTURES_PATH, "user-schema.ts");
      const { stderr } = runCliWithError(["generate", schemaPath, "-s", "nonExistentSchema"]);
      expect(stderr).toContain("not exported");
    });
  });

  describe("form command", () => {
    const schemaPath = path.join(FIXTURES_PATH, "user-schema.ts");
    const settingsPath = path.join(FIXTURES_PATH, "kelex.settings.jsonc");

    it("generates a wired form from the plugins the settings name", () => {
      const outputPath = path.join(TEST_OUTPUT_DIR, "user.html");

      const result = runCli([
        "form",
        schemaPath,
        "-e",
        "userSchema",
        "-c",
        settingsPath,
        "-o",
        outputPath,
      ]);

      expect(result).toContain("Generated");
      expect(result).toContain("@kelex/plugin-renderer-html + @kelex/plugin-handler-post");
      const html = fs.readFileSync(outputPath, "utf-8");
      expect(html.startsWith("<form")).toBe(true);
      expect(html).toContain('action="/fixture-submit"'); // renderer.options from the settings
      expect(html).toContain("<script>"); // the handler wired it
    });

    it("is the default command, and -a overrides the settings' action", () => {
      const outputPath = path.join(TEST_OUTPUT_DIR, "user-action.html");

      runCli([schemaPath, "-e", "userSchema", "-c", settingsPath, "-o", outputPath, "-a", "/x"]);

      const html = fs.readFileSync(outputPath, "utf-8");
      expect(html).toContain('action="/x"');
      expect(html).not.toContain('action="/fixture-submit"');
    });

    it("fails naming the handler a flag gives, instead of loading the settings' handler", () => {
      const outputPath = path.join(TEST_OUTPUT_DIR, "user-handler.html");

      const { stderr } = runCliWithError([
        "form",
        schemaPath,
        "-e",
        "userSchema",
        "-c",
        settingsPath,
        "-o",
        outputPath,
        "-H",
        "@kelex/no-such-handler",
      ]);

      expect(stderr).toContain('cannot resolve plugin "@kelex/no-such-handler"');
      expect(fs.existsSync(outputPath)).toBe(false);
    });

    // A consumer project in a temp dir, with third-party plugins in the two
    // shapes Node loads differently from the defaults: an ESM renderer whose
    // exports map has only an "import" condition, and a TypeScript-compiled
    // CommonJS handler. The CLI runs from elsewhere, so the plugins resolve
    // only if kelex looks next to the settings file.
    describe("third-party plugins in a consumer project", () => {
      const rendererDist = pathToFileURL(
        path.resolve(__dirname, "../packages/plugin-renderer-html/dist/index.js"),
      ).href;
      let project: string;

      function installPackage(name: string, manifest: object, files: Record<string, string>) {
        const dir = path.join(project, "node_modules", name);
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(
          path.join(dir, "package.json"),
          JSON.stringify({ name, version: "1.0.0", ...manifest }),
        );
        for (const [file, text] of Object.entries(files)) {
          fs.writeFileSync(path.join(dir, file), text);
        }
      }

      // An ESM-only renderer that wraps the default one and marks its output.
      function installRenderer(name: string) {
        installPackage(
          name,
          { type: "module", exports: { ".": { import: "./index.js" } } },
          {
            "index.js": [
              `import createHtmlRenderer from "${rendererDist}";`,
              "export default (options) => {",
              "  const base = createHtmlRenderer(options);",
              `  return { ...base, form: (children) => "<!-- ${name} -->" + base.form(children) };`,
              "};",
            ].join("\n"),
          },
        );
      }

      beforeAll(() => {
        project = fs.mkdtempSync(path.join(os.tmpdir(), "kelex-consumer-"));
        fs.writeFileSync(path.join(project, "package.json"), `{ "name": "consumer" }`);
        installRenderer("esm-renderer");
        installRenderer("other-renderer");
        installPackage(
          "cjs-handler",
          { main: "./index.js" },
          {
            "index.js": [
              '"use strict";',
              'Object.defineProperty(exports, "__esModule", { value: true });',
              'exports.default = () => ({ wire: (form) => form + "<!-- cjs-handler -->" });',
            ].join("\n"),
          },
        );
        fs.writeFileSync(
          path.join(project, "kelex.settings.jsonc"),
          `{ "renderer": "esm-renderer", "handler": "cjs-handler" }`,
        );
      });

      afterAll(() => {
        fs.rmSync(project, { recursive: true, force: true });
      });

      it("loads both from the settings file's directory, not the working directory", () => {
        const outputPath = path.join(TEST_OUTPUT_DIR, "consumer.html");
        const settings = path.join(project, "kelex.settings.jsonc");

        runCli([schemaPath, "-e", "userSchema", "-c", settings, "-o", outputPath], os.tmpdir());

        const html = fs.readFileSync(outputPath, "utf-8");
        expect(html.startsWith("<!-- esm-renderer --><form")).toBe(true);
        expect(html.endsWith("<!-- cjs-handler -->")).toBe(true);
      });

      it("loads the renderer -r names instead of the settings' renderer", () => {
        const outputPath = path.join(TEST_OUTPUT_DIR, "consumer-r.html");
        const settings = path.join(project, "kelex.settings.jsonc");

        runCli([
          schemaPath,
          "-e",
          "userSchema",
          "-c",
          settings,
          "-o",
          outputPath,
          "-r",
          "other-renderer",
        ]);

        const html = fs.readFileSync(outputPath, "utf-8");
        expect(html.startsWith("<!-- other-renderer --><form")).toBe(true);
        expect(html).not.toContain("esm-renderer");
      });
    });
  });

  describe("targets command", () => {
    it("lists available targets", () => {
      const result = runCli(["targets"]);

      expect(result).toContain("composite");
      expect(result).toContain(".composite.json");
      expect(result).not.toContain("react-tanstack");
    });
  });

  describe("generate --target", () => {
    it("shows help with --target option", () => {
      const result = runCli(["generate", "--help"]);

      expect(result).toContain("--target");
    });

    it("shows error for unknown target", () => {
      const schemaPath = path.join(FIXTURES_PATH, "user-schema.ts");
      const { stderr } = runCliWithError([
        "generate",
        schemaPath,
        "-s",
        "userSchema",
        "--target",
        "nonexistent",
      ]);
      expect(stderr).toContain("Unknown target");
    });
  });

  describe("help", () => {
    it("shows help for generate command", () => {
      const result = runCli(["generate", "--help"]);

      expect(result).toContain("Generate a form component");
      expect(result).toContain("--output");
      expect(result).toContain("--name");
      expect(result).toContain("--schema");
      expect(result).not.toContain("--ui");
    });

    it("reports the package.json version", () => {
      const result = runCli(["--version"]);
      expect(result.trim()).toBe(packageVersion);
    });
  });
});
