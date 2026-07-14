import { describe, expect, it } from "vitest";
import { writeSchema } from "../../src/schema-writer/writer";
import { makeField, makeForm } from "./helpers";

describe("writeSchema", () => {
  describe("output structure", () => {
    it("generates correct import statement", () => {
      const form = makeForm({
        fields: [makeField({ name: "name" })],
      });
      const result = writeSchema({ form });
      expect(result.code).toContain('import { z } from "zod/v4";');
    });

    it("generates const export with schema name", () => {
      const form = makeForm({
        schemaExportName: "userSchema",
        fields: [makeField({ name: "name" })],
      });
      const result = writeSchema({ form });
      expect(result.code).toContain("export const userSchema = z.object({");
    });

    it("generates type export with inferred name", () => {
      const form = makeForm({
        schemaExportName: "userSchema",
        fields: [makeField({ name: "name" })],
      });
      const result = writeSchema({ form });
      expect(result.code).toContain("export type User = z.infer<typeof userSchema>;");
    });

    it("generates type name from profileSchema -> Profile", () => {
      const form = makeForm({
        schemaExportName: "profileSchema",
        fields: [makeField({ name: "bio" })],
      });
      const result = writeSchema({ form });
      expect(result.code).toContain("export type Profile = z.infer<typeof profileSchema>;");
    });

    it("returns empty warnings when all fields succeed", () => {
      const form = makeForm({
        fields: [makeField({ name: "name" })],
      });
      const result = writeSchema({ form });
      expect(result.warnings).toEqual([]);
    });
  });

  describe("field ordering", () => {
    it("preserves field order in output", () => {
      const form = makeForm({
        fields: [
          makeField({ name: "alpha" }),
          makeField({ name: "beta" }),
          makeField({ name: "gamma" }),
        ],
      });
      const result = writeSchema({ form });
      const alphaIdx = result.code.indexOf("alpha:");
      const betaIdx = result.code.indexOf("beta:");
      const gammaIdx = result.code.indexOf("gamma:");
      expect(alphaIdx).toBeLessThan(betaIdx);
      expect(betaIdx).toBeLessThan(gammaIdx);
    });
  });

  describe("multiple field types", () => {
    it("generates full schema with mixed types", () => {
      const form = makeForm({
        schemaExportName: "contactSchema",
        fields: [
          makeField({
            name: "name",
            type: "string",
            metadata: { kind: "string" },
          }),
          makeField({
            name: "email",
            type: "string",
            constraints: { format: "email" },
            metadata: { kind: "string" },
          }),
          makeField({
            name: "age",
            type: "number",
            metadata: { kind: "number" },
          }),
          makeField({
            name: "active",
            type: "boolean",
            metadata: { kind: "boolean" },
          }),
          makeField({
            name: "role",
            type: "enum",
            metadata: { kind: "enum", values: ["admin", "user"] },
          }),
          makeField({
            name: "tags",
            type: "array",
            metadata: {
              kind: "array",
              element: makeField({
                name: "item",
                type: "string",
                metadata: { kind: "string" },
              }),
            },
          }),
        ],
      });
      const result = writeSchema({ form });

      expect(result.code).toContain("name: z.string(),");
      expect(result.code).toContain("email: z.email(),");
      expect(result.code).toContain("age: z.number(),");
      expect(result.code).toContain("active: z.boolean(),");
      expect(result.code).toContain('role: z.enum(["admin", "user"]),');
      expect(result.code).toContain("tags: z.array(z.string()),");
      expect(result.code).toContain("export type Contact = z.infer<typeof contactSchema>;");
    });

    it("emits record type through writer", () => {
      const form = makeForm({
        fields: [
          makeField({
            name: "scores",
            type: "record",
            metadata: {
              kind: "record",
              valueDescriptor: makeField({
                name: "value",
                type: "number",
                metadata: { kind: "number" },
              }),
            },
          }),
        ],
      });
      const result = writeSchema({ form });
      expect(result.code).toContain("scores: z.record(z.string(), z.number())");
    });
  });

  describe("tuple fields", () => {
    it("generates tuple field in schema output", () => {
      const form = makeForm({
        fields: [
          makeField({
            name: "coord",
            type: "tuple",
            metadata: {
              kind: "tuple",
              elements: [
                makeField({
                  name: "0",
                  type: "string",
                  metadata: { kind: "string" },
                }),
                makeField({
                  name: "1",
                  type: "number",
                  metadata: { kind: "number" },
                }),
              ],
            },
          }),
        ],
      });
      const result = writeSchema({ form });
      expect(result.code).toContain("coord: z.tuple([z.string(), z.number()]),");
    });
  });

  describe("nested object fields", () => {
    it("emits nested object fields", () => {
      const form = makeForm({
        fields: [
          makeField({
            name: "address",
            type: "object",
            metadata: {
              kind: "object",
              fields: [
                makeField({
                  name: "street",
                  type: "string",
                  metadata: { kind: "string" },
                }),
                makeField({
                  name: "city",
                  type: "string",
                  metadata: { kind: "string" },
                }),
              ],
            },
          }),
        ],
      });
      const result = writeSchema({ form });
      expect(result.code).toContain("address: z.object({ street: z.string(), city: z.string() }),");
    });
  });

  describe("error handling", () => {
    it("throws on unsupported type", () => {
      const form = makeForm({
        fields: [
          makeField({
            name: "unknown",
            type: "unknown" as "string",
            metadata: { kind: "string" },
          }),
        ],
      });
      expect(() => writeSchema({ form })).toThrow('Unsupported field type "unknown"');
    });
  });

  describe("empty schema", () => {
    it("generates valid empty object schema", () => {
      const form = makeForm({ fields: [] });
      const result = writeSchema({ form });
      expect(result.code).toContain("export const testSchema = z.object({");
      expect(result.code).toContain("});");
    });
  });

  describe("embedded schemas", () => {
    it("emits a single embedded schema before the main schema", () => {
      const addressForm = makeForm({
        name: "AddressForm",
        schemaExportName: "addressSchema",
        fields: [
          makeField({
            name: "street",
            type: "string",
            metadata: { kind: "string" },
          }),
          makeField({
            name: "city",
            type: "string",
            metadata: { kind: "string" },
          }),
        ],
      });

      const mainForm = makeForm({
        schemaExportName: "userSchema",
        fields: [
          makeField({
            name: "name",
            type: "string",
            metadata: { kind: "string" },
          }),
          makeField({
            name: "address",
            type: "object",
            metadata: { kind: "object", fields: [] },
            schemaRef: "addressSchema",
          }),
        ],
      });

      const result = writeSchema({
        form: mainForm,
        embeddedSchemas: [{ form: addressForm }],
      });

      // Embedded schema appears before main schema
      const addressIdx = result.code.indexOf("export const addressSchema");
      const userIdx = result.code.indexOf("export const userSchema");
      expect(addressIdx).toBeGreaterThan(-1);
      expect(userIdx).toBeGreaterThan(-1);
      expect(addressIdx).toBeLessThan(userIdx);

      // Type exports for both
      expect(result.code).toContain("export type Address = z.infer<typeof addressSchema>;");
      expect(result.code).toContain("export type User = z.infer<typeof userSchema>;");

      // Field uses identifier instead of inline
      expect(result.code).toContain("address: addressSchema,");
      expect(result.code).not.toContain("address: z.object(");
    });

    it("emits multiple independent embedded schemas", () => {
      const addressForm = makeForm({
        name: "AddressForm",
        schemaExportName: "addressSchema",
        fields: [
          makeField({
            name: "street",
            type: "string",
            metadata: { kind: "string" },
          }),
        ],
      });

      const phoneForm = makeForm({
        name: "PhoneForm",
        schemaExportName: "phoneSchema",
        fields: [
          makeField({
            name: "number",
            type: "string",
            metadata: { kind: "string" },
          }),
        ],
      });

      const mainForm = makeForm({
        schemaExportName: "contactSchema",
        fields: [
          makeField({
            name: "address",
            type: "object",
            metadata: { kind: "object", fields: [] },
            schemaRef: "addressSchema",
          }),
          makeField({
            name: "phone",
            type: "object",
            metadata: { kind: "object", fields: [] },
            schemaRef: "phoneSchema",
          }),
        ],
      });

      const result = writeSchema({
        form: mainForm,
        embeddedSchemas: [{ form: addressForm }, { form: phoneForm }],
      });

      // Both embedded schemas appear before main
      const addrIdx = result.code.indexOf("export const addressSchema");
      const phoneIdx = result.code.indexOf("export const phoneSchema");
      const contactIdx = result.code.indexOf("export const contactSchema");
      expect(addrIdx).toBeLessThan(contactIdx);
      expect(phoneIdx).toBeLessThan(contactIdx);

      // Type exports for all three
      expect(result.code).toContain("export type Address = z.infer<typeof addressSchema>;");
      expect(result.code).toContain("export type Phone = z.infer<typeof phoneSchema>;");
      expect(result.code).toContain("export type Contact = z.infer<typeof contactSchema>;");
    });

    it("topologically sorts nested embedded schemas (A references B)", () => {
      // locationSchema has no dependencies
      const locationForm = makeForm({
        name: "LocationForm",
        schemaExportName: "locationSchema",
        fields: [
          makeField({
            name: "lat",
            type: "number",
            metadata: { kind: "number" },
          }),
          makeField({
            name: "lng",
            type: "number",
            metadata: { kind: "number" },
          }),
        ],
      });

      // addressSchema depends on locationSchema
      const addressForm = makeForm({
        name: "AddressForm",
        schemaExportName: "addressSchema",
        fields: [
          makeField({
            name: "street",
            type: "string",
            metadata: { kind: "string" },
          }),
          makeField({
            name: "location",
            type: "object",
            metadata: { kind: "object", fields: [] },
            schemaRef: "locationSchema",
          }),
        ],
      });

      const mainForm = makeForm({
        schemaExportName: "userSchema",
        fields: [
          makeField({
            name: "address",
            type: "object",
            metadata: { kind: "object", fields: [] },
            schemaRef: "addressSchema",
          }),
        ],
      });

      // Pass schemas in WRONG order (address before location)
      const result = writeSchema({
        form: mainForm,
        embeddedSchemas: [{ form: addressForm }, { form: locationForm }],
      });

      // locationSchema must appear before addressSchema
      const locationIdx = result.code.indexOf("export const locationSchema");
      const addressIdx = result.code.indexOf("export const addressSchema");
      const userIdx = result.code.indexOf("export const userSchema");
      expect(locationIdx).toBeLessThan(addressIdx);
      expect(addressIdx).toBeLessThan(userIdx);
    });

    it("throws on circular references among embedded schemas", () => {
      const schemaA = makeForm({
        name: "AForm",
        schemaExportName: "schemaA",
        fields: [
          makeField({
            name: "b",
            type: "object",
            metadata: { kind: "object", fields: [] },
            schemaRef: "schemaB",
          }),
        ],
      });

      const schemaB = makeForm({
        name: "BForm",
        schemaExportName: "schemaB",
        fields: [
          makeField({
            name: "a",
            type: "object",
            metadata: { kind: "object", fields: [] },
            schemaRef: "schemaA",
          }),
        ],
      });

      const mainForm = makeForm({
        schemaExportName: "mainSchema",
        fields: [
          makeField({
            name: "a",
            type: "object",
            metadata: { kind: "object", fields: [] },
            schemaRef: "schemaA",
          }),
        ],
      });

      expect(() =>
        writeSchema({
          form: mainForm,
          embeddedSchemas: [{ form: schemaA }, { form: schemaB }],
        }),
      ).toThrow("Circular reference detected");
    });

    it("backward compatible: no embedded schemas works as before", () => {
      const form = makeForm({
        schemaExportName: "userSchema",
        fields: [
          makeField({
            name: "name",
            type: "string",
            metadata: { kind: "string" },
          }),
        ],
      });

      const result = writeSchema({ form });
      expect(result.code).toContain('import { z } from "zod/v4";');
      expect(result.code).toContain("export const userSchema = z.object({");
      expect(result.code).toContain("  name: z.string(),");
      expect(result.code).toContain("export type User = z.infer<typeof userSchema>;");
      expect(result.warnings).toEqual([]);
    });

    it("backward compatible: empty embeddedSchemas array works as before", () => {
      const form = makeForm({
        schemaExportName: "userSchema",
        fields: [
          makeField({
            name: "name",
            type: "string",
            metadata: { kind: "string" },
          }),
        ],
      });

      const resultWithout = writeSchema({ form });
      const resultWith = writeSchema({ form, embeddedSchemas: [] });
      expect(resultWith.code).toBe(resultWithout.code);
    });

    it("emits only one import statement for the whole file", () => {
      const addressForm = makeForm({
        name: "AddressForm",
        schemaExportName: "addressSchema",
        fields: [
          makeField({
            name: "street",
            type: "string",
            metadata: { kind: "string" },
          }),
        ],
      });

      const mainForm = makeForm({
        schemaExportName: "userSchema",
        fields: [
          makeField({
            name: "address",
            type: "object",
            metadata: { kind: "object", fields: [] },
            schemaRef: "addressSchema",
          }),
        ],
      });

      const result = writeSchema({
        form: mainForm,
        embeddedSchemas: [{ form: addressForm }],
      });

      const importCount = (result.code.match(/import \{ z \}/g) ?? []).length;
      expect(importCount).toBe(1);
    });

    it("produces correct full output matching expected format", () => {
      const addressForm = makeForm({
        name: "AddressForm",
        schemaExportName: "addressSchema",
        fields: [
          makeField({
            name: "street",
            type: "string",
            metadata: { kind: "string" },
          }),
          makeField({
            name: "city",
            type: "string",
            metadata: { kind: "string" },
          }),
          makeField({
            name: "zip",
            type: "string",
            metadata: { kind: "string" },
          }),
        ],
      });

      const mainForm = makeForm({
        schemaExportName: "userSchema",
        fields: [
          makeField({
            name: "name",
            type: "string",
            metadata: { kind: "string" },
          }),
          makeField({
            name: "address",
            type: "object",
            metadata: { kind: "object", fields: [] },
            schemaRef: "addressSchema",
          }),
        ],
      });

      const result = writeSchema({
        form: mainForm,
        embeddedSchemas: [{ form: addressForm }],
      });

      const expected = [
        'import { z } from "zod/v4";',
        "",
        "export const addressSchema = z.object({",
        "  street: z.string(),",
        "  city: z.string(),",
        "  zip: z.string(),",
        "});",
        "",
        "export type Address = z.infer<typeof addressSchema>;",
        "",
        "export const userSchema = z.object({",
        "  name: z.string(),",
        "  address: addressSchema,",
        "});",
        "",
        "export type User = z.infer<typeof userSchema>;",
        "",
      ].join("\n");

      expect(result.code).toBe(expected);
    });
  });
});
