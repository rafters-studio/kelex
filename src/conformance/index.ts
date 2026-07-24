import { controlPaths } from "../engine/paths";
import { validateRenderer } from "../engine/pipeline";
import { render } from "../engine/render";
import { route } from "../engine/route";
import type { Handler, Renderer } from "../engine/types";
import { introspect, type IntrospectOptions } from "../introspection";
import type { FieldType } from "../introspection/types";
import { battery } from "./battery";
import { fuzzSchemas } from "./fuzz";

/** The five contract invariants a conforming plugin must honor. */
export type Invariant = "floor" | "totality" | "path-preservation" | "handler-join" | "determinism";

/** One invariant broken by one schema, with the detail needed to reproduce it. */
export interface ConformanceFailure {
  invariant: Invariant;
  schema: string;
  detail: string;
}

/** What conformance actually exercised -- surfaced so no coverage is silently capped. */
export interface ConformanceCoverage {
  /** Schemas run through the schema-only invariants (battery + fuzz). */
  schemas: number;
  /** Battery cases carrying crafted bad data -- the handler-join surface. */
  handlerJoinCases: number;
  /** Invariants that ran over every schema, only the battery, or once per renderer. */
  everySchema: Invariant[];
  batteryOnly: Invariant[];
  rendererLevel: Invariant[];
}

export interface ConformanceReport {
  passed: boolean;
  failures: ConformanceFailure[];
  coverage: ConformanceCoverage;
}

/**
 * How to read the stamped control names out of a rendered `T`. Path-preservation
 * asserts against the ACTUAL output, and `T` is opaque to the engine, so the
 * caller supplies the reader (regex `name="..."` for a string renderer, a tree
 * walk for a structured one). Deliberately NOT part of `Renderer<T>` -- it is a
 * conformance concern, not the runtime contract a plugin ships.
 */
export interface ConformanceOptions<T> {
  names: (rendered: T) => string[];
  /** Fuzzer seed (default 1) -- a failure reproduces from it. */
  seed?: number;
  /** How many random schemas to fuzz (default 25). */
  fuzzCount?: number;
  /**
   * Scope the run to a subset of FieldTypes -- the floor checks only these
   * catch-alls, the battery keeps only cases whose shapes fit, and the fuzzer
   * emits only these. A leaf-only renderer proves itself against the scalar
   * types without owning a container composer it does not have yet.
   */
  types?: FieldType[];
}

const OPTS: IntrospectOptions = {
  formName: "ConformanceForm",
  schemaImportPath: "./schema",
  schemaExportName: "schema",
};

/** `~standard`'s validate surface, narrowed from the schema without a hard zod dep. */
interface StandardValidatable {
  "~standard": {
    validate: (
      value: unknown,
    ) =>
      | { issues?: readonly { message: string; path?: readonly unknown[] }[] }
      | Promise<{ issues?: readonly { message: string; path?: readonly unknown[] }[] }>;
  };
}

const serialize = (value: unknown): string => JSON.stringify(value);

/**
 * Prove a plugin honors the contract. Runs the five invariants over a shape
 * battery plus fuzzed schemas: FLOOR (the renderer covers every FieldType),
 * TOTALITY (no field falls to `fallback`), PATH-PRESERVATION (every control path
 * appears as a stamped name in the OUTPUT), DETERMINISM (two renders are
 * identical), and HANDLER-JOIN (real bad data validates and every issue binds).
 * Floor is renderer-level and short-circuits (a floor gap dooms totality too, so
 * report it alone). Handler-join needs crafted leaf-path bad data, so it runs
 * over the battery only; the fuzzer drives the other three. Returns the failures
 * and a coverage summary -- nothing is silently skipped.
 */
export async function conformance<T>(
  renderer: Renderer<T>,
  handler: Handler<T> | undefined,
  options: ConformanceOptions<T>,
): Promise<ConformanceReport> {
  const { names, seed = 1, fuzzCount = 25, types } = options;
  const failures: ConformanceFailure[] = [];
  const coverage: ConformanceCoverage = {
    schemas: 0,
    handlerJoinCases: 0,
    everySchema: ["totality", "path-preservation", "determinism"],
    batteryOnly: ["handler-join"],
    rendererLevel: ["floor"],
  };

  // FLOOR -- renderer-level, once (scoped to `types` when given). A gap here means
  // fields will fall to fallback, so report floor alone rather than drowning it in
  // totality noise.
  const gaps = validateRenderer(renderer, types);
  if (gaps.length > 0) {
    return {
      passed: false,
      failures: gaps.map((detail) => ({ invariant: "floor", schema: "(renderer)", detail })),
      coverage,
    };
  }

  // A `types` scope keeps only battery cases whose shapes fit, and fuzzes within
  // those types -- so a leaf-only renderer never sees a container it disowns.
  const allowed = types && new Set(types);
  const scopedBattery = allowed
    ? battery.filter((c) => c.uses.every((t) => allowed.has(t)))
    : battery;
  const schemas = [...scopedBattery, ...fuzzSchemas(seed, fuzzCount, types)];
  coverage.schemas = schemas.length;

  for (const { name, schema } of schemas) {
    const descriptor = introspect(schema, OPTS);
    const controlKeys = controlPaths(descriptor).map((c) => c.key);

    // DETERMINISM -- two renders, byte-identical once serialized.
    const first = render(descriptor, renderer);
    const second = render(descriptor, renderer);
    if (serialize(first) !== serialize(second)) {
      failures.push({ invariant: "determinism", schema: name, detail: "two renders differ" });
    }

    // TOTALITY -- probe fallback; a conforming renderer never reaches it here.
    let fellBack = false;
    render(descriptor, {
      ...renderer,
      fallback: (input) => {
        fellBack = true;
        return renderer.fallback(input);
      },
    });
    if (fellBack) {
      failures.push({ invariant: "totality", schema: name, detail: "a field hit fallback" });
    }

    // PATH-PRESERVATION -- read names from the ACTUAL output (wired, if a handler
    // is given: a handler must not drop a control either).
    const output = handler ? handler.wire(first, controlPaths(descriptor), descriptor) : first;
    const stamped = new Set(names(output));
    const missing = controlKeys.filter((k) => !stamped.has(k));
    if (missing.length > 0) {
      failures.push({
        invariant: "path-preservation",
        schema: name,
        detail: `unstamped control(s): ${missing.join(", ")}`,
      });
    }
  }

  // HANDLER-JOIN -- battery cases with crafted bad data only (within the type
  // scope). Real `~standard` validation; every resulting issue must bind.
  for (const { name, schema, bad } of scopedBattery) {
    if (bad === undefined) continue;
    coverage.handlerJoinCases++;
    const descriptor = introspect(schema, OPTS);
    const result = await (schema as unknown as StandardValidatable)["~standard"].validate(bad);
    const issues = result.issues ?? [];
    if (issues.length === 0) {
      failures.push({
        invariant: "handler-join",
        schema: name,
        detail: "bad data produced no issues",
      });
      continue;
    }
    const unbound = route(controlPaths(descriptor), issues).filter((b) => b.control === undefined);
    if (unbound.length > 0) {
      failures.push({
        invariant: "handler-join",
        schema: name,
        detail: `unbound issue(s): ${unbound.map((b) => b.key).join(", ")}`,
      });
    }
  }

  return { passed: failures.length === 0, failures, coverage };
}
