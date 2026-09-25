import { describe, expect, it } from "vitest";
import { z } from "zod/v4";
import { introspect } from "../../src/introspection";
import { writeSchema } from "../../src/schema-writer/writer";
import { compositeTarget } from "../../src/targets";

const schema = z.object({ email: z.email() });

describe("library-mode introspect, with no import path or export name (#250)", () => {
  it("emits an artifact without the two keys, which the type declares optional", () => {
    const descriptor = introspect(schema, { formName: "SignupForm" });
    const [file] = compositeTarget.generate(descriptor, {}).files;
    const artifact = JSON.parse(file.content) as Record<string, unknown>;
    expect(Object.keys(artifact)).not.toContain("schemaImportPath");
    expect(Object.keys(artifact)).not.toContain("schemaExportName");
    expect(artifact.name).toBe("SignupForm");
  });

  it("still carries both keys when the caller passes them, as the CLI does", () => {
    const descriptor = introspect(schema, {
      formName: "SignupForm",
      schemaImportPath: "./signup",
      schemaExportName: "signupSchema",
    });
    const artifact = JSON.parse(compositeTarget.generate(descriptor, {}).files[0].content);
    expect(artifact.schemaImportPath).toBe("./signup");
    expect(artifact.schemaExportName).toBe("signupSchema");
  });

  it("lets the schema-writer derive an export name from the form name", () => {
    const { code } = writeSchema({ form: introspect(schema, { formName: "SignupForm" }) });
    expect(code).toContain("export const signupSchema = z.object({");
    expect(code).toContain("export type Signup = z.infer<typeof signupSchema>;");
    expect(code).not.toContain("undefined");
  });
});
