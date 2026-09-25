import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
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
    expect(releaseProblems("0.2.0", root)).toEqual(['tag "0.2.0" is not v<major>.<minor>.<patch>']);
    expect(releaseProblems("v0.2", root)).toHaveLength(1);
  });

  it("checks the three packages that publish", () => {
    expect(PACKAGES).toEqual([
      ".",
      "packages/plugin-renderer-html",
      "packages/plugin-handler-post",
    ]);
  });
});
