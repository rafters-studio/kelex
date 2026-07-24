import { describe, expect, it } from "vitest";
import { z } from "zod/v4";
import { extractConstraints } from "../../src/introspection/checks";

describe("extractConstraints", () => {
  describe("string constraints", () => {
    it("extracts email format", () => {
      const schema = z.string().email();
      const constraints = extractConstraints(schema);
      expect(constraints).toEqual({ format: "email" });
    });

    it("extracts url format", () => {
      const schema = z.string().url();
      const constraints = extractConstraints(schema);
      expect(constraints).toEqual({ format: "url" });
    });

    it("extracts uuid format", () => {
      const schema = z.string().uuid();
      const constraints = extractConstraints(schema);
      expect(constraints).toEqual({ format: "uuid" });
    });

    it("extracts cuid format", () => {
      const schema = z.string().cuid();
      const constraints = extractConstraints(schema);
      expect(constraints).toEqual({ format: "cuid" });
    });

    it("extracts datetime format", () => {
      const schema = z.string().datetime();
      const constraints = extractConstraints(schema);
      expect(constraints).toEqual({ format: "datetime" });
    });

    it("extracts minLength and maxLength", () => {
      const schema = z.string().min(5).max(100);
      const constraints = extractConstraints(schema);
      expect(constraints).toEqual({ minLength: 5, maxLength: 100 });
    });

    it("extracts regex pattern", () => {
      const schema = z.string().regex(/^[A-Z]+$/);
      const constraints = extractConstraints(schema);
      expect(constraints).toEqual({ pattern: "^[A-Z]+$" });
    });

    it("extracts multiple string constraints", () => {
      const schema = z.string().min(1).max(50).email();
      const constraints = extractConstraints(schema);
      expect(constraints).toEqual({
        minLength: 1,
        maxLength: 50,
        format: "email",
      });
    });
  });

  describe("number constraints", () => {
    it("extracts min and max", () => {
      const schema = z.number().min(0).max(10);
      const constraints = extractConstraints(schema);
      expect(constraints).toEqual({ min: 0, max: 10 });
    });

    it("extracts int constraint", () => {
      const schema = z.number().int();
      const constraints = extractConstraints(schema);
      expect(constraints).toEqual({ isInt: true });
    });

    it("extracts multipleOf as step", () => {
      const schema = z.number().multipleOf(0.5);
      const constraints = extractConstraints(schema);
      expect(constraints).toEqual({ step: 0.5 });
    });

    it("extracts multiple number constraints", () => {
      const schema = z.number().min(0).max(100).int();
      const constraints = extractConstraints(schema);
      expect(constraints).toEqual({ min: 0, max: 100, isInt: true });
    });
  });

  describe("no constraints", () => {
    it("returns empty object for plain string", () => {
      const schema = z.string();
      const constraints = extractConstraints(schema);
      expect(constraints).toEqual({});
    });

    it("returns empty object for plain number", () => {
      const schema = z.number();
      const constraints = extractConstraints(schema);
      expect(constraints).toEqual({});
    });

    it("returns empty object for boolean", () => {
      const schema = z.boolean();
      const constraints = extractConstraints(schema);
      expect(constraints).toEqual({});
    });

    it("returns empty object for date", () => {
      const schema = z.date();
      const constraints = extractConstraints(schema);
      expect(constraints).toEqual({});
    });

    it("returns empty object for enum", () => {
      const schema = z.enum(["a", "b", "c"]);
      const constraints = extractConstraints(schema);
      expect(constraints).toEqual({});
    });
  });

  describe("edge cases", () => {
    it("handles zero values correctly", () => {
      const schema = z.number().min(0).max(0);
      const constraints = extractConstraints(schema);
      expect(constraints).toEqual({ min: 0, max: 0 });
    });

    it("handles negative number constraints", () => {
      const schema = z.number().min(-100).max(-1);
      const constraints = extractConstraints(schema);
      expect(constraints).toEqual({ min: -100, max: -1 });
    });

    it("handles complex regex patterns", () => {
      const schema = z.string().regex(/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+$/);
      const constraints = extractConstraints(schema);
      expect(constraints.pattern).toBe("^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+$");
    });
  });
});
