#!/usr/bin/env node
// Release guard: the pushed tag must be v<version>, and every published package
// must carry that same version, since kelex and its plugins release together.
// Usage: node scripts/check-release-version.mjs v0.2.0
import { readFileSync } from "node:fs";
import { join } from "node:path";

export const PACKAGES = [".", "packages/plugin-renderer-html", "packages/plugin-handler-post"];

/** The problems with releasing `tag` from `root`, or an empty list when there are none. */
export function releaseProblems(tag, root = process.cwd()) {
  const match = /^v(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)$/.exec(tag ?? "");
  if (!match) return [`tag "${tag}" is not v<major>.<minor>.<patch>`];
  const version = match[1];
  return PACKAGES.flatMap((dir) => {
    const manifest = JSON.parse(readFileSync(join(root, dir, "package.json"), "utf8"));
    return manifest.version === version
      ? []
      : [`${manifest.name} is ${manifest.version}, but the tag is ${tag}`];
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const problems = releaseProblems(process.argv[2]);
  for (const problem of problems) console.error(`release: ${problem}`);
  process.exit(problems.length > 0 ? 1 : 0);
}
