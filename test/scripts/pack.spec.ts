import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pkg from "../../package.json";

// Integration: packs the real packages the release publishes and reads the
// manifests inside the tarballs, as npm will (#244). Needs `pnpm build`.

const ROOT = resolve(__dirname, "../..");
const PLUGINS = ["@rafters/kelex-renderer-html", "@rafters/kelex-handler-post"];
let out: string;

const manifestOf = (tarball: string): Record<string, unknown> =>
  JSON.parse(execFileSync("tar", ["-xzOf", tarball, "package/package.json"], { encoding: "utf8" }));

beforeAll(() => {
  out = mkdtempSync(join(tmpdir(), "kelex-pack-"));
  execFileSync("pnpm", ["pack", "--pack-destination", out], { cwd: ROOT, stdio: "pipe" });
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

describe("packed packages, as the release publishes them", () => {
  it("name their tarballs the way the publish step expects", () => {
    expect(readdirSync(out).sort()).toEqual([
      `rafters-kelex-${pkg.version}.tgz`,
      `rafters-kelex-handler-post-${pkg.version}.tgz`,
      `rafters-kelex-renderer-html-${pkg.version}.tgz`,
    ]);
  });

  it("publish the core as @rafters/kelex with the kelex command", () => {
    const core = manifestOf(join(out, `rafters-kelex-${pkg.version}.tgz`));
    expect(core.name).toBe("@rafters/kelex");
    expect(core.bin).toEqual({ kelex: "./dist/cli.js" });
  });

  it("carry a real version range on the plugins' @rafters/kelex peer, not workspace:", () => {
    for (const file of readdirSync(out).filter((f) => f !== `rafters-kelex-${pkg.version}.tgz`)) {
      const peers = manifestOf(join(out, file)).peerDependencies as Record<string, string>;
      expect(peers["@rafters/kelex"], file).toBe(`^${pkg.version}`);
    }
  });
});
