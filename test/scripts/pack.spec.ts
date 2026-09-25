import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pkg from "../../package.json";

// Integration: packs the real packages the release publishes and reads the
// manifests inside the tarballs, as npm will (#244). Needs `pnpm build`.

const ROOT = resolve(__dirname, "../..");
const PLUGINS = ["@kelex/plugin-renderer-html", "@kelex/plugin-handler-post"];
let out: string;

const manifestOf = (tarball: string): Record<string, unknown> =>
  JSON.parse(execFileSync("tar", ["-xzOf", tarball, "package/package.json"], { encoding: "utf8" }));

beforeAll(() => {
  out = mkdtempSync(join(tmpdir(), "kelex-pack-"));
  for (const name of PLUGINS) {
    execFileSync("pnpm", ["--filter", name, "pack", "--pack-destination", out], {
      cwd: ROOT,
      stdio: "pipe",
    });
  }
});
afterAll(() => {
  rmSync(out, { recursive: true, force: true });
});

describe("packed plugins, as the release publishes them", () => {
  it("name their tarballs the way the publish step expects", () => {
    expect(readdirSync(out).sort()).toEqual([
      `kelex-plugin-handler-post-${pkg.version}.tgz`,
      `kelex-plugin-renderer-html-${pkg.version}.tgz`,
    ]);
  });

  it("carry a real version range on their kelex peer, not workspace:", () => {
    for (const file of readdirSync(out)) {
      const peers = manifestOf(join(out, file)).peerDependencies as Record<string, string>;
      expect(peers.kelex, file).toBe(`^${pkg.version}`);
    }
  });
});
