import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PACKAGES, releaseProblems } from "../../scripts/check-release-version.mjs";

let root: string;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "kelex-release-"));
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

function packagesAt(versions: string[]): void {
  PACKAGES.forEach((dir, i) => {
    mkdirSync(join(root, dir), { recursive: true });
    writeFileSync(
      join(root, dir, "package.json"),
      JSON.stringify({ name: `pkg-${i}`, version: versions[i] }),
    );
  });
}

describe("the release version guard (#244)", () => {
  it("passes when the tag matches every package", () => {
    packagesAt(["0.2.0", "0.2.0", "0.2.0"]);
    expect(releaseProblems("v0.2.0", root)).toEqual([]);
  });

  it("names each package whose version differs from the tag", () => {
    packagesAt(["0.2.0", "0.1.2", "0.2.0"]);
    expect(releaseProblems("v0.2.0", root)).toEqual(["pkg-1 is 0.1.2, but the tag is v0.2.0"]);
  });

  it("refuses a tag that is not v<major>.<minor>.<patch>", () => {
    packagesAt(["0.2.0", "0.2.0", "0.2.0"]);
    expect(releaseProblems("0.2.0", root)).toEqual([
      'tag "0.2.0" is not v<major>.<minor>.<patch> (prereleases are not supported)',
    ]);
    expect(releaseProblems("v0.2", root)).toHaveLength(1);
  });

  it("refuses a prerelease tag even when the versions match", () => {
    packagesAt(["0.3.0-rc.1", "0.3.0-rc.1", "0.3.0-rc.1"]);
    expect(releaseProblems("v0.3.0-rc.1", root)).toHaveLength(1);
  });

  it("checks the three packages that publish", () => {
    expect(PACKAGES).toEqual([
      ".",
      "packages/plugin-renderer-html",
      "packages/plugin-handler-post",
    ]);
  });

  // The entry-point check once failed open through a symlink: run the script as a
  // process, directly and through a link, and require a non-zero exit on a bad tag.
  describe("run as a script", () => {
    const script = resolve(__dirname, "../../scripts/check-release-version.mjs");
    const exitCode = (path: string, tag: string): number => {
      try {
        execFileSync("node", [path, tag], { cwd: root, stdio: "pipe" });
        return 0;
      } catch (error) {
        return (error as { status: number }).status;
      }
    };

    it("exits 0 on a matching tag and 1 on a mismatch", () => {
      packagesAt(["0.2.0", "0.2.0", "0.2.0"]);
      expect(exitCode(script, "v0.2.0")).toBe(0);
      expect(exitCode(script, "v9.9.9")).toBe(1);
    });

    it("still checks, and fails a mismatch, when run through a symlink", () => {
      packagesAt(["0.2.0", "0.2.0", "0.2.0"]);
      const link = join(root, "check.mjs");
      symlinkSync(script, link);
      expect(exitCode(link, "v9.9.9")).toBe(1);
    });
  });
});
