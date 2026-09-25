// Compiled by `pnpm typecheck` (tsconfig.types.json), never run.
import { z } from "zod/v4";
import { introspect } from "../../src/introspection";
import type { FormDescriptor } from "../../src/introspection/types";

// A library caller may omit the import path and export name (#250).
export const descriptor: FormDescriptor = introspect(z.object({ a: z.string() }), {
  formName: "T",
});

// Reading them must account for absence: without the optional chain this fails.
export const length: number | undefined = descriptor.schemaExportName?.length;
// @ts-expect-error schemaExportName may be undefined, so `.length` needs a check
export const unchecked: number = descriptor.schemaExportName.length;
