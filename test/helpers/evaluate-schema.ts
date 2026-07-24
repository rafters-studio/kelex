import { z } from "zod/v4";

/**
 * Evaluates generated Zod schema code by stripping import/export syntax
 * and executing with the z object injected.
 *
 * This is intentional: round-trip tests need to evaluate the generated code
 * to verify it produces a valid Zod schema. The input is always from our own
 * writeSchema function, never from user input.
 */
export function evaluateSchemaCode(code: string): z.ZodObject {
  const executableCode = code
    .replace(/import\s*\{[^}]*\}\s*from\s*["'][^"']*["'];?\n?/g, "")
    .replace(/export\s+type\s+[^;]*;\n?/g, "")
    .replace(/export\s+const/g, "const");

  // Using Function constructor to evaluate our own generated code in tests.
  // The input is always from writeSchema(), never from external/user input.
  const fn = new Function("z", `${executableCode}\nreturn testSchema;`);
  return fn(z);
}
