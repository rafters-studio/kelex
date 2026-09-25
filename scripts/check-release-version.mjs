#!/usr/bin/env node
// Release guard: the pushed tag must be v<version>, and every published package
// must carry that same version, since kelex and its plugins release together.
// Usage: node scripts/check-release-version.mjs v0.2.0
import { readFileSync, realpathSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

export const PACKAGES = [".", "packages/plugin-renderer-html", "packages/plugin-handler-post"];

/** The problems with releasing `tag` from `root`, or an empty list when there are none. */
export function releaseProblems(tag, root = process.cwd()) {
  // Plain releases only: a prerelease would need an npm dist-tag the publish step does not set.
  const match = /^v(\d+\.\d+\.\d+)$/.exec(tag ?? "");
  if (!match)
    return [`tag "${tag}" is not v<major>.<minor>.<patch> (prereleases are not supported)`];
  const version = match[1];
  return PACKAGES.flatMap((dir) => {
    const manifest = JSON.parse(readFileSync(join(root, dir, "package.json"), "utf8"));
    return manifest.version === version
      ? []
      : [`${manifest.name} is ${manifest.version}, but the tag is ${tag}`];
  });
}

// Run as a script, however it was invoked (a symlink or relative path included).
const invoked = process.argv[1] ? pathToFileURL(realpathSync(process.argv[1])).href : "";
if (import.meta.url === invoked) {
  const problems = releaseProblems(process.argv[2]);
  for (const problem of problems) console.error(`release: ${problem}`);
  process.exit(problems.length > 0 ? 1 : 0);
}
