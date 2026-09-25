// Compiled by `pnpm typecheck` (tsconfig.types.json), never run.
import { z } from "zod/v4";
import { generateForm, writeForm } from "../../src";
import type { FormResult } from "../../src";

const schema = z.object({ a: z.string() });

// The caller names the output type; HTML plugins produce a string (#255).
export async function htmlForm(): Promise<void> {
  const { output } = await generateForm<string>(schema);
  writeForm("form.html", output);
}

// A tree renderer's output comes back typed as the tree, not a string.
export async function treeForm(): Promise<{ tree: string }> {
  const result: FormResult<{ tree: string }> = await generateForm<{ tree: string }>(schema);
  return result.output;
}

// Without a type argument the output is unknown, so it cannot be written as text.
export async function untyped(): Promise<void> {
  const { output } = await generateForm(schema);
  // @ts-expect-error output is unknown until the caller names what the plugins return
  writeForm("form.html", output);
}
