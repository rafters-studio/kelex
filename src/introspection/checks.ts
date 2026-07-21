import type { $ZodType } from "zod/v4/core";
import type { FieldConstraints } from "./types";

interface ZodCheckDef {
  check: string;
  minimum?: number;
  maximum?: number;
  value?: number;
  /** Present on greater_than/less_than: whether the bound is inclusive (.gte/.lte/.min/.max) or exclusive (.gt/.lt/.positive) */
  inclusive?: boolean;
  /** Exact length from length_equals (z.string().length(n)) */
  length?: number;
  format?: string;
  pattern?: RegExp;
  /** Literal prefix on string_format with format "starts_with" */
  prefix?: string;
  /** Literal suffix on string_format with format "ends_with" */
  suffix?: string;
}

interface ZodCheck {
  _zod?: { def?: ZodCheckDef };
  format?: string;
  isInt?: boolean;
}

const KNOWN_FORMATS = new Set(["email", "url", "uuid", "cuid", "datetime"] as const);

/**
 * Def-level number formats that imply an integer. `z.int()` is "safeint"; the
 * sized integer helpers carry their own format. Any of these sets `isInt`.
 */
const INTEGER_NUMBER_FORMATS = new Set(["safeint", "int32", "uint32"]);

/**
 * Extracts validation constraints from a Zod schema's checks array
 * and top-level def properties (format for z.email()/z.url()/z.uuid()).
 * Must be called on unwrapped schema (not optional/nullable wrapper).
 */
export function extractConstraints(schema: $ZodType, unknownChecks?: string[]): FieldConstraints {
  const def = schema._zod.def as {
    type: string;
    format?: string;
    checks?: ZodCheck[];
  };

  const constraints: FieldConstraints = {};

  // Zod v4 top-level format (z.email(), z.url(), z.uuid() set def.format directly)
  if (def.format && def.type === "string") {
    const fmt = def.format;
    if (
      fmt === "email" ||
      fmt === "url" ||
      fmt === "uuid" ||
      fmt === "cuid" ||
      fmt === "datetime"
    ) {
      constraints.format = fmt;
    }
  }

  // z.int() carries its int-ness as a def-level number format ("safeint"),
  // where z.number().int() carries it as a number_format check. Without this,
  // the idiomatic z.int() lost its int-ness and hashed differently from the
  // equivalent z.number().int() (#178).
  if (def.type === "number" && def.format && INTEGER_NUMBER_FORMATS.has(def.format)) {
    constraints.isInt = true;
  }

  const checks = def.checks;
  if (!checks || !Array.isArray(checks)) {
    return constraints;
  }

  for (const check of checks) {
    const checkDef = check._zod?.def;
    if (!checkDef) continue;

    switch (checkDef.check) {
      case "min_length":
        if (checkDef.minimum !== undefined) {
          // For array types, store as minItems
          if (def.type === "array") {
            constraints.minItems = checkDef.minimum;
          } else {
            constraints.minLength = checkDef.minimum;
          }
        }
        break;

      case "max_length":
        if (checkDef.maximum !== undefined) {
          if (def.type === "array") {
            constraints.maxItems = checkDef.maximum;
          } else {
            constraints.maxLength = checkDef.maximum;
          }
        }
        break;

      case "length_equals":
        if (checkDef.length !== undefined) {
          constraints.length = checkDef.length;
        }
        break;

      case "string_format":
        if (checkDef.format === "regex" && checkDef.pattern) {
          constraints.pattern = checkDef.pattern.source;
        } else if (checkDef.format === "starts_with" && checkDef.prefix !== undefined) {
          constraints.startsWith = checkDef.prefix;
        } else if (checkDef.format === "ends_with" && checkDef.suffix !== undefined) {
          constraints.endsWith = checkDef.suffix;
        } else if (
          checkDef.format &&
          KNOWN_FORMATS.has(checkDef.format as FieldConstraints["format"] & string)
        ) {
          constraints.format = checkDef.format as FieldConstraints["format"];
        } else {
          unknownChecks?.push(
            checkDef.format ? `string_format:${checkDef.format}` : "string_format",
          );
        }
        break;

      case "greater_than":
        if (checkDef.value !== undefined) {
          constraints.min = checkDef.value;
          // .positive()/.gt() are exclusive; .nonnegative()/.gte()/.min() are inclusive
          if (checkDef.inclusive === false) {
            constraints.minExclusive = true;
          }
        }
        break;

      case "less_than":
        if (checkDef.value !== undefined) {
          constraints.max = checkDef.value;
          if (checkDef.inclusive === false) {
            constraints.maxExclusive = true;
          }
        }
        break;

      case "number_format":
        if (check.isInt) {
          constraints.isInt = true;
        }
        break;

      case "multiple_of":
        if (checkDef.value !== undefined) {
          constraints.step = checkDef.value;
        }
        break;

      default:
        unknownChecks?.push(checkDef.check);
        break;
    }
  }

  return constraints;
}
