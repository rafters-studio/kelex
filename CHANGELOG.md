# @rafters-studio/kelex

## 1.0.0

### Major Changes

- d5f29c6: Remove the mapping module from the public API. `resolveField`, `findMatchingRule`, `defaultMappingRules` and the `ComponentConfig`, `ComponentType` and `MappingRule` types are no longer exported from the package root.

  kelex does not own component selection. Which component renders a field belongs to the consumer, along with the rest of the presentation layer — kelex carries presentation data losslessly and makes no presentation decisions. Exporting a component-selection table contradicted that boundary in the one place a consumer would actually discover it.

  The module remains in the tree, unmodified. It is unreachable from the pipeline — `generate()` calls `introspect()` and the target directly, and has never called `resolveField` — so nothing in kelex's behavior changes.

  Consumers that were importing these should own the field-type-to-component table on their side, reading `FieldDescriptor.type`, `constraints` and `metadata` from the descriptor to make the choice.

### Minor Changes

- 40b9cec: Add the plugin conformance harness (`conformance`). Runs the five contract
  invariants -- floor, totality, path-preservation, determinism, and handler-join
  -- over a shape battery plus seeded fuzzed schemas, so a plugin author (and
  kelex's own defaults) can prove a renderer/handler honors the contract.
  Path-preservation reads stamped names out of the actual rendered output via a
  caller-supplied `names` reader (the output `T` is opaque to the engine);
  handler-join validates crafted bad data with real Standard Schema and asserts
  every issue binds. Fuzzing targets the schema space, never a plugin's components.
- be37f6e: Remove the react-tanstack target and all React/JSX code generation. The composite JSON FormDescriptor target is now the only built-in target and the CLI default. The audited React codegen did not compile against current @tanstack/react-form and is being replaced by a new target design; the pre-cut state is tagged `pre-codegen-cut`. Also removes the unused zocker test infrastructure, fixes the broken `test:spec` script, and makes `kelex --version` report the real package version.
- 6794922: Carry a discriminated-union discriminator with its real type. `buildUnionMetadata` did `String(value)`, so a boolean or numeric discriminator (`z.literal(true)`, `z.literal(1)`) became the string `"true"`/`"1"` -- and the writer re-emitted `z.literal("true")`, producing a schema that rejects the boolean/number the original accepted. `variants[].value` is now `string | number | boolean` sourced from the literal, and the writer re-emits `z.literal(true)`/`z.literal(1)`. String discriminators are unchanged.
- 28e641d: Add `render(descriptor, renderer): T` -- the plugin engine's fold. One recursive rule over the schema's topology: each field is matched to an inventory entry (first match), its config resolved, and a shape-specific `Input` (control/group/list/choice/recursive) handed to the matched composer or the renderer's fallback. Every control's `key` is its canonical path (`*` for template slots), a union folds to a `choice` with the discriminator dropped from variant fields, and a `ref` folds to a `recursive` boundary without recursing. Generic in `T`; names nothing about markup.
- 3b71208: Add the plugin engine's contract: the `Renderer<T>`/`Handler<T>`/`Composer<T>`/`Input<T>` interfaces over five form-word shapes (`control`/`group`/`list`/`choice`/`recursive`), the `Entry`/`Match`/`Setting`/`Control`/`Child` types, the internal match/config engine (`matches` first-match resolution, `resolveConfig` `$ref` resolution), and the internal `controlPaths` join manifest (`*` for template slots, stopping at a recursion boundary). The `PathSegment`/`RECORD_VALUE`/`formatPath` path helpers are lifted to a shared internal module. The plugin API exports form-word types only; the CS terms (`path`, `matches`, `controlPaths`) stay internal.
- 7be0a2f: Add `renderForm(descriptor, renderer, handler?)` -- the engine pipeline (`wire . render`) -- and `validateRenderer` (the floor). The floor requires a TYPE-ONLY catch-all for every `FieldType` (a constrained entry does not prove the bare type is handled) and a composer for every named component; `renderForm` runs it and throws on gaps rather than dropping a field. Named to avoid colliding with the existing `generate()`/`CodegenTarget` target path, which is left untouched.
- fca0c7c: Add `route(controls, issues)` -- the join executed. It maps Standard Schema validation issues back to the controls a renderer stamped: each issue's runtime path (`tags.2.label`) binds to a control key (`tags.*.label`) by segment match with `*` as a wildcard for template slots, and `{key}`-wrapped segments are normalized. Standard Schema issue paths come back as raw `PathSegment[]` and match kelex's keys 1:1; an issue matching no control is surfaced with `control` undefined, never dropped. This is the helper every handler uses to route validation errors to error slots by path.
- fb9c8f2: Add a descriptor FORMAT version. `FormDescriptor` gains a top-level `formatVersion: number` (currently `1`) describing the shape of the descriptor itself, distinct from `version` (which hashes one schema's content). A `FORMAT_VERSION` constant is exported. It is excluded from the content hash (which covers `fields` only), so it does not churn `version`, and it is stamped top-level in the composite artifact. A consumer reading an unrecognized `formatVersion` should fail closed rather than guess at an unknown shape.
- 66ba1ef: Validate a target's output at the `generate()` seam. `generate()` passed a target's result straight through, so a buggy (especially third-party) target could throw a raw error deep in the caller, return a `files: []` / malformed shape the compile-time `TargetResult` type could not catch, or silently drop a descriptor field. `generate()` -- the single seam every target passes through -- now wraps a target throw with the target name and form context, runtime-validates the result shape with a clear error naming the target, and appends a `target-field-unprocessed` warning (new `WarningCode`, emitted only here, never by `introspect()`) for each descriptor field the target did not report processing. The composite target passes cleanly.
- 4f1cf6b: Add the default async-POST handler (`postHandler` / `createPostHandler`) -- the
  handler half of the default pair. `wire` wraps a rendered form in place with a
  self-contained runtime script that: gates the client with native HTML5
  validation (no zod in the browser), collects values by `name` (= path),
  un-flattens them to nested JSON, and `fetch`-POSTs to the form's action; routes
  server-returned `~standard` issues to each control's path-addressed error slot
  (unbound issues go to a form-level sink, never dropped); and owns the
  interactivity the renderer left inert -- union variant show/hide (inactive
  panels are disabled, so they neither submit nor block validation) and array
  add/remove (cloning the `<template>` row and re-indexing `*` -> 0,1,2, with a
  monotonic index and compact-on-collect so removes leave no gap). It imports only
  the public contract, has no inventory (uniform over paths), and passes
  conformance paired with the default HTML renderer.
- a9f4d9f: Promote an implicit discriminator in a plain union of tagged objects. A `z.union([...])` whose members are all objects sharing one literal field with distinct values is semantically discriminated, but only `z.discriminatedUnion` set a `discriminator` before — a plain union got `variant_N` placeholders and no selector. `buildUnionMetadata` now detects that shared literal field and promotes it (typed variant values, per #187), producing a descriptor identical to the equivalent `z.discriminatedUnion`. Zero candidates leaves the union unchanged; more than one warns (`discriminator-ambiguous`) and promotes nothing rather than guess.
- f3e66a4: Represent literals faithfully. `z.literal("x")` had `type: "string"` with `metadata.kind: "literal"` -- an in-band contradiction the schema-writer resolved by emitting `z.string()`, dropping the literal entirely; a multi-value `z.literal(["a","b"])` kept only the first value. Literals now have a first-class `type: "literal"` whose metadata carries all `values`, and the writer re-emits `z.literal(...)`.

  **Version note:** a literal field's representation changed, so any schema containing a literal -- including a discriminated union's discriminator fields -- gets a new content `version`. The canonical fixture is re-pinned accordingly. `FieldType` gains `"literal"` and the literal `FieldMetadata` changes from `{ value }` to `{ values }`.

- 248ffc9: Represent recursive schemas with a `ref` node instead of dropping them. A `z.lazy`/self-referential schema (a category tree, a comment thread) previously resolved to an `unsupported-type` warning and an unrepresented leaf. Introspection now unwraps `z.lazy` with cycle detection (by schema instance): a non-recursive lazy is transparent, and a self-reference emits a `{ kind: "ref"; target }` node at the cycle's closing edge, pointing at the ancestor it refers back to, so a consumer can render a recursive widget. Adds the `"ref"` `FieldType`/metadata kind and bumps `FORMAT_VERSION` to `2`. The schema-writer emits `z.unknown()` (with a warning) for a `ref`, since a recursive schema cannot be reconstructed from the flat descriptor.
- b8838aa: Package renamed from @rafters-studio/kelex to @rafters/kelex. Toolchain modernized: TypeScript 7 (native compiler), tsdown replaces tsup, vitest 4, oxlint + oxfmt replace Biome, pnpm 11 with an allowBuilds approval in pnpm-workspace.yaml so fresh installs work non-interactively. CI now builds before testing and runs the full suite including integration specs; the release workflow gates publishing on tests.
- 572b85e: Complete the default base-HTML renderer -- containers, form, buttons, and an
  example stylesheet (#228). `object`/`tuple` render as `<fieldset><legend>`;
  `array`/`record` as a repeater (a `<template>` row carrying the `*` path + inert
  `data-add-row`/`data-remove-row` buttons); `union` as a switch (a
  `data-variant-of` selector that stamps a discriminated union's discriminator +
  `data-variant`/`data-when` panels); a recursive boundary as an inert marker. The
  `form` composer now wraps a real `<form action>` (via the new
  `createHtmlRenderer({ action })` factory; `htmlRenderer` stays the default
  instance) with a submit button -- all interactivity is inert, owned by the post
  handler (#227). With the leaf inventory the renderer passes the FULL floor and
  full conformance. Ships `@rafters/kelex/form.css`, a classless example sheet.
- ef4bde8: Add the default base-HTML renderer -- leaf half (`htmlRenderer`). A
  zero-dependency, classless renderer whose ordered inventory is the canonical
  reference: format (email/url), meta-hint (password/otp/tel), and
  constraint-bucket (long string -> textarea, bounded number -> range)
  specializations sit above a type-only catch-all for every scalar FieldType.
  Every control emits the hook trio (`name` = path, injective `id = pathToId`,
  `data-path`), native validation attributes from the schema's constraints, a
  `<label for>`, the aria pair, and a path-addressed error slot -- inert markup,
  no behavior. Also adds a `types` scope to `conformance`/`validateRenderer` so a
  leaf-only renderer proves itself against the scalar shapes. Containers, the real
  `<form action>`, buttons, and the stylesheet are the container half (#228).
- fb116ee: **Structured warnings.** `FormDescriptor.warnings` and `GenerateResult.warnings` change from `string[]` to `Warning[]`, where a `Warning` is `{ path: PathSegment[]; code: WarningCode; message: string }`. Consumers switch on the stable `code` and locate by `path` (Standard Schema convention) rather than parsing prose.

  This is a **breaking change**, chosen deliberately: the package is pre-1.0 with no external consumers, and leaving the prose `string[]` in place would let a consumer freeze the wording. `WarningCode` is a stable enum (`catch-fallback-dropped`, `transform-output-dropped`, `format-unrecognized`, `refine-unrepresented`, `unsupported-type`, ...). The `message` is unchanged prose for CLI display. `generate()` wraps a target's own prose warnings as `{ code: "target-warning", path: [] }` so the combined list is uniform. `Warning` and `WarningCode` are exported from the package root.

- afbbcd3: Mark synthetic union variants explicitly. The reader wraps a non-object union member (the `z.number()` in `z.union([z.object({...}), z.number()])`) in a single-field object so every variant has a uniform shape, but nothing marked the wrapper -- so the writer reverse-engineered it from a `"variant_N"` / `"option_N"` name pattern. That heuristic misfired on a real object whose only field is literally named `option_0`, round-tripping `z.union([z.object({ option_0: z.string() }), z.number()])` to `z.union([z.string(), z.number()])` and deleting the object. Union variants now carry a `synthetic?: true` marker; the writer keys off it and consumers can tell a wrapped scalar from a real single-field object.
- 54fb524: Carry union variant labels from member `.meta()`. A union variant now surfaces its member schema's `.meta()` payload as `variants[].meta` (verbatim, like `FieldDescriptor.meta`), so a consumer can label the variant chooser — `z.union([Card.meta({ title: "Card" }), Bank.meta({ title: "Bank" })])`. It is read off the member instance via the wrapper-chain-walking `collectMeta`, works for discriminated and plain unions, and is absent when the member has no meta. Because a variant label is presentation, not contract, it is excluded from the content `version` hash (a variant `meta`/`label` no longer churns the version).

### Patch Changes

- e43821d: Fix `.catch()` degrading every field to an unconstrained string. `z.number().min(5).catch(0)` introspected as `type: "string"` with no constraints, and an enum lost its values entirely — so a renderer would emit a text input for a number field. The catch wrapper is now peeled and the inner type and constraints survive.

  The fallback value itself is still not carried, and warns instead. Zod stores `.catch(0)` as a callback rather than a literal, so recovering it would mean invoking user code during introspection — and a context-dependent callback returns a plausible, type-valid, fabricated value that nothing downstream could distinguish from a real one.

  **Descriptor version note:** this changes what a caught field introspects to, so `FormDescriptor.version` rerolls for any schema using `.catch()`. The content hash is stable for a given kelex version and a given schema; an introspection fix that changes what the reader sees will move it. Consumers pinning against the version should expect it to change on a kelex upgrade, not only on a schema edit.

- afbdf56: Warn on coercion and unknown-key policy. `z.coerce.number()` introspected as a plain number, and `z.strictObject()`/`.catchall()`/`.passthrough()` introspected identically to a plain `z.object()` — both dropped with no warning, silently changing what inputs a form accepts and widening a strict object to a permissive one on round-trip. Both now produce a path-qualified warning (a top-level strict object warns at `(form)`).
- 0c899bd: Sanitize the composite target's derived filename. The base name came straight from `form.name` (strip `Form`, kebab-case), so `form.name === "Form"` produced `.composite.json` -- a hidden dotfile -- and a name containing `/` or `\` put path separators in the filename. The CLI has a path-traversal guard, but a library consumer writing `files[]` directly does not. The composite target now replaces path separators with dashes, strips leading dots, and falls back to `form` when the derived name is empty. Normal PascalCase names are unchanged.
- b49d587: Fix `z.date()` bounds putting a Date into a number-typed constraint. `z.date().min(new Date(...))` assigned the Date to `constraints.min`, which is typed `number` — so the composite JSON carried a string where the contract said number, aimed straight at a Rust reader deserializing it as a float, and the writer dropped the bound entirely on round-trip. Date bounds now live in dedicated `minDate`/`maxDate` ISO-string slots; numeric `min`/`max` stay strictly numeric, and the writer re-emits `.min(new Date(...))`.
- 9921cad: Fix two `.default()` defects in the reader.

  A **function default is no longer baked in as a fabricated literal**. Zod 4 exposes `def.defaultValue` as a getter that invokes a function default on every access, so `z.number().default(() => Math.random())` was recording a per-call value. The value is now read twice and trusted only when the two reads are structurally equal: a static default, a constant function (`() => 42`), and a fresh-but-equal object (`() => []`) are recorded as before; a varying default (`Math.random`, `crypto.randomUUID`, a counter) records nothing and warns, so the descriptor and its version hash stay deterministic. This is the same never-fabricate rule already applied to `.catch()`.

  Known residual: a coarse time default (`() => Date.now()`) whose two reads land in the same millisecond still reads as stable and is recorded — no worse than before, and it affects only that schema's version determinism.

  **default-of-default now records the value Zod applies.** `z.string().default("inner").default("outer")` recorded `"inner"`; Zod applies `"outer"`. The outermost default now wins, and an unstable outer default no longer falls through to a shadowed inner one.

- c432fcf: Fix `z.enum()` reporting the wrong values for the object form. `z.enum({ Red: "r", Blue: "b" })` reported `["Red", "Blue"]` (the keys), but the schema accepts the VALUES — `.parse("Red")` fails, `.parse("r")` succeeds. A plugin rendering a select from those values submitted data the schema rejected. The descriptor now carries the accepted values (`["r", "b"]`); the array form (`z.enum(["a","b"])`, keys == values) is unchanged.

  Numeric enums are now carried too: their values are recorded (with reverse-mapping entries of a TS enum dropped), and the schema-writer re-emits them as a union of literals accepting the same set, with a warning that it is not a `z.enum()`. `FieldMetadata` for enums widened from `readonly string[]` to `readonly (string | number)[]`.

- 95d2e57: An intersection used as a field value now flattens to a merged object, instead of degrading to a string. `z.object({ address: z.intersection(Base, Timestamped) })` previously introspected `address` as an unconstrained string with an "unsupported type" warning, dropping the merged shape and any `.refine()` on it — the same silent-drop class #153 closed, but for intersection fields rather than intersection roots.

  Field-level intersections now merge exactly as root ones do: the combined shape, overlapping-key warnings, and member/nested refine warnings, all carrying the field's path (`Field "address"`, `Field "outer.inner"`) rather than reading as form-level. Non-object members still error, and the merged field round-trips through the schema writer.

  Root-intersection behavior is unchanged — the path threading defaults to empty at the root.

- fe2b8e7: Minor robustness fixes from the foundation audit. A non-finite default (`Infinity`, `-Infinity`, `NaN`) is now refused and warned rather than emitted as `.default(null)` (silent corruption). Identical warnings are de-duplicated. A discriminated-union variant whose discriminator is not a literal warns rather than fabricating a `z.literal("unknown")`. The no-default vs `.default(undefined)` ambiguity, `Object.entries` integer-key field ordering, and the fact that introspection may invoke a refinement's error callback are now documented in code.
- c684b0c: Warn on `.refine()` at every intersection level. A refinement attached to an intersection nested inside another intersection was dropped silently — `flattenIntersection` scanned its object branch but not its intersection branch, so it recursed past intermediate nodes and discarded their checks.

  Root-refinement warnings now come from a single owner (`resolveRootSchema`) rather than two call sites, so a root-level refinement is reported exactly once. Warning count is unchanged for every shape that already warned; only coverage widened.

- 66ecf26: Remove the `node:crypto` dependency from the programmatic API. `computeVersion` ran on every `introspect()` call and imported `createHash` from `node:crypto`, so importing kelex as a library in a browser, a worker, Deno, or an edge runtime failed at module load. Core is now runtime-agnostic; `node:` imports remain only in the CLI, where they belong.

  Replaced with a dependency-free synchronous SHA-256. Web Crypto was not an option: `crypto.subtle.digest` is async, which would have forced `computeVersion` and therefore `introspect()` to become async — a breaking change to the package's central API for the sake of an implementation detail.

  **No descriptor versions change.** The implementation produces byte-identical digests to `node:crypto`, asserted against it directly across the SHA-256 padding boundaries, multi-block inputs and non-ASCII encoding, and confirmed by comparing the canonical fixture's version before and after the swap. Consumers pinned against a `FormDescriptor.version` see no movement.

- d71dc97: Fix `z.readonly()` degrading a field's type. `z.number().readonly()` introspected as type `"string"` (with a warning), losing the inner number type and its constraints, for one transparent wrapper. `readonly` now joins the peeled wrapper set, so the inner type and constraints survive and `.meta()` on the inner schema is still found. `z.lazy()` and recursive schemas remain a documented limitation (warn-and-degrade).
- 40f3cac: Refine warnings now carry the author's message and say plainly what cannot be known.

  A `.refine()` the descriptor cannot represent previously reported only that a refinement existed. It now includes the message the author wrote — `"end must be after start"` — which is the only human-readable description of a rule the consumer has to reimplement by hand.

  Zod normalizes `{ message }` into an error function rather than storing the string, so recovering it means calling user code. A supplied `error` callback may format from the failing value, where calling it would invent a message for an input that never existed — so the formatter is called twice with different synthetic issues and the result is used only when both agree. A constant message is identical both times; a value-dependent one is not; one that reaches into a real input shape throws and is discarded. Nothing is fabricated.

  A refinement with an explicit `path` now renders that path in full rather than just its first segment. One without is reported as **form-level** and states that the fields it constrains are not recoverable, instead of the previous `Field "(form)"` — which read like a field genuinely named that. Zod keeps only the opaque predicate, so the honest answer is that the information does not exist.

  Warning count is unchanged.

- fa36ba9: Preserve regex flags. `FieldConstraints.pattern` carried only `RegExp.source`, so `z.string().regex(/abc/i)` round-tripped to `/abc/` — silently flipping case-sensitivity and narrowing the schema. A `patternFlags` slot now carries the flags, the writer re-emits `/abc/i`, and because flags change what validates they participate in the version hash.
- f2cb083: Warn when a `.transform()` or `.pipe()` output side is dropped. The reader peels a pipe to its input side (what a form collects), but the transformed output type and any output-side constraints were dropped with no warning — `z.string().transform(s => s.length)` introspected as a plain string, and its version hash matched a plain `z.string()`, so a consumer could not see a transform being added or removed. The input side is still read; a path-qualified warning now names the field whose output side is not represented.
- 516677d: Warn on unrecognized string formats. `z.iso.date()`, `z.ipv4()`, `z.jwt()`, `z.base64()` and other Zod 4 string formats carry a def-level `format` with no check, so they slipped past the checks loop and degraded to an unconstrained string with no warning (the writer then re-emitted `z.string()`). An unrecognized def-level string format now produces a path-qualified warning; the five represented formats (email, url, uuid, cuid, datetime) are unchanged.
- ad11a9d: Fix two defects in the descriptor content hash.

  **A bigint no longer crashes `introspect()`.** `computeVersion` serialized fields with `JSON.stringify`, which throws on bigint, so any bigint literal or default (`z.literal(1n)`, `z.bigint().default(5n)`) killed the whole pipeline. Hashing now uses a bigint- and Date-aware stable serializer. The composite target, which had the same `JSON.stringify` landmine independently, renders a bigint as its decimal string rather than throwing.

  **Presentation keys no longer collide inside value payloads.** The `label`/`description`/`meta`/`schemaRef` exclusion was applied at every object depth, including the CONTENTS of a `defaultValue` object, so three defaults `{label:"aaa",x:1}`, `{label:"bbb",x:1}`, `{x:1}` all hashed the same -- skew-detection blindness. The exclusion now applies only to an object recognized as a FieldDescriptor, never to a user value payload.

  No version churns for existing schemas: the canonical fixture still hashes to `11617b63d9d43a33`, and a field-level `.meta()` label is still excluded.

- 9d8fa69: Warnings now identify a field by its full path rather than its leaf name. A field nested four levels down reported as `Field "name"` with no branch; tuple elements reported as `Field "0"` and `Field "1"` with nothing tying them to their tuple; a record value reported as `Field "value"`; and two same-named fields in different branches produced byte-identical warnings.

  Paths follow Standard Schema's `PathSegment[]` convention — `bag[0].quality`, `identity.origin.discipline.name`, `coords[0]` — so a warning can be matched against a `~standard` issue path. A record's value position uses a wildcard (`stats.*`), since its real key is not known until validation.

  Top-level fields still render as a bare name, and the number of warnings produced is unchanged. Only their content moved. The record-key warning gained a location it never had — it previously named no field at all.

- d0ae3d7: Fix `z.int()` losing its int-ness. `z.int()` carries the constraint as a def-level number format (`"safeint"`), where `z.number().int()` carries it as a check — so the idiomatic Zod 4 spelling introspected as a plain number and hashed differently from the equivalent `z.number().int()`. Both now produce `isInt: true` and the same version; the sized-integer formats (`int32`, `uint32`) are covered too.

## 0.1.2

### Patch Changes

- Configure npm OIDC trusted publishing for automated releases

## 0.1.1

### Patch Changes

- 8e0ded6: Add deep assertions for all 11 stress test schemas

  - 3 new test blocks per schema (introspection fidelity, component mapping, JSX structure)
  - Full assertion tables covering field types, optionality, nullability, constraints, and nested paths
  - 55 total stress tests (up from 22), covering all composite types (Fieldset, FieldArray, UnionSwitch)

## 0.1.0

### Minor Changes

- 3c1828c: Initial release of kelex - generate React form components from Zod schemas.

  Features:

  - CLI tool for generating forms from Zod schema files
  - Support for string, number, boolean, date, and enum types
  - Automatic component selection based on field constraints
  - TanStack Form integration for state management
  - Rafters/shadcn UI component support
  - Full TypeScript type inference from schemas
  - Programmatic API for custom build pipelines
