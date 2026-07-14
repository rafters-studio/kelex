import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { version as packageVersion } from "../package.json";

const CLI_PATH = path.resolve(__dirname, "../dist/cli.js");
const FIXTURES_PATH = path.resolve(__dirname, "fixtures");
const TEST_OUTPUT_DIR = path.resolve(__dirname, "fixtures/output");

function runCli(args: string[]): string {
  return execFileSync("node", [CLI_PATH, ...args], { encoding: "utf-8" });
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
