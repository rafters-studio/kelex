import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Entry } from "kelex/engine";

// The module's own directory as a filesystem path. `import.meta.dirname` (Node
// 20.11+) avoids the URL scheme, which some bundlers/test runners rewrite away
// from `file://`; fall back to the URL form for older/edge runtimes.
const here = import.meta.dirname ?? dirname(fileURLToPath(import.meta.url));

/**
 * Load the ordered inventory from the shipped `inventory.jsonl` — the DATA half
 * of the renderer, one `Entry` per line. Kept as a file (not a TS array) so it
 * is editable on its own, e.g. by a future UI. `//` lines and blanks are skipped.
 */
export function loadInventory(): Entry[] {
  const path = join(here, "..", "inventory.jsonl");
  return readFileSync(path, "utf8")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("//"))
    .map((line) => JSON.parse(line) as Entry);
}
