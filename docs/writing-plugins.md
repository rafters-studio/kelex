# Writing plugins

kelex's engine is consumer-agnostic. It folds a `FormDescriptor` through two
independent adapters and knows nothing about HTML, React, or your component kit:

```typescript
renderForm(descriptor, renderer, handler?) // = handler ? wire(render(...), ...) : render(...)
```

- A **`Renderer<T>`** turns the descriptor into output of some type `T` — an HTML
  string, a component tree, a template AST, anything.
- A **`Handler<T>`** wires that output — state, validation, submit — by control
  path.

They never call each other. They meet at one join: the descriptor's **canonical
path**. The renderer stamps each control's `name` with its path; the handler
routes validation issues back to controls by that same path. Build one, both, or
mix a kit's renderer with someone else's handler.

The default `htmlRenderer` and `postHandler` are the reference implementation —
they import only what this guide describes. Read their source alongside it.

## The renderer contract

```typescript
interface Renderer<T> {
  inventory: Entry[]; // data: match a field -> a component
  compose: Record<string, Composer<T>>; // code: build T for a component
  form: (children: Child<T>[]) => T; // wrap the top-level fields
  fallback: Composer<T>; // a field no entry matched
}
```

### The five shapes

`render` walks the schema's own topology. Every field is one of five shapes, and
your composer receives an `Input<T>` telling it which:

| shape       | schema topology              | the `Input` carries                   |
| ----------- | ---------------------------- | ------------------------------------- |
| `control`   | a scalar (string, number, …) | just `field`, `key`, `config`         |
| `group`     | an object or tuple           | `children: Child<T>[]`                |
| `list`      | an array or record           | `item: Child<T>` (a `*` slot)         |
| `choice`    | a union                      | `variants: Variant<T>[]`              |
| `recursive` | a `z.lazy` boundary          | nothing below (the widget expands it) |

A `Child<T>` is `{ field, key, rendered }` — its subtree is **already rendered**
to `T`, so a composer just places `child.rendered`; it never recurses itself.
`key` is the canonical path (`tags.*.label`, with `*` for a template slot).

```typescript
const composers: Record<string, Composer<string>> = {
  input: (i) => `<input name="${i.key}" ${attrs(i.field, i.config)}>`,
  group: (i) =>
    i.shape === "group" ? `<fieldset>${i.children.map((c) => c.rendered).join("")}</fieldset>` : "",
  // ...list, choice, recursive
};
```

### The inventory: matching a field to a component

The inventory is **data** — an ordered list of entries. `render` picks the
**first** entry whose `match` the field satisfies, then calls the composer named
by that entry's `component`.

```typescript
interface Entry {
  match: Match; // a predicate over a field's facts
  component: string; // -> compose[component]
  settings?: Record<string, Setting>; // resolved into the composer's `config`
}
```

`Match` pins `type` and optionally narrows on `format`, a `.meta({ ui })` hint,
length/number buckets, or object field names:

```typescript
// order = precedence; specializations sit above the type-only catch-all
[
  { match: { type: "string", format: "email" }, component: "input", settings: { type: "email" } },
  { match: { type: "string", maxLength: { gte: 256 } }, component: "textarea" },
  { match: { type: "string" }, component: "input", settings: { type: "text" } }, // catch-all
];
```

`settings` become the composer's `config` after `$ref`s are resolved from the
field's own facts — `"$values"` reads the enum's values, `{ ref: "$maxLength", default: 100 }`
reads a constraint or falls back. So a composer only ever sees final values.

### The floor

Because kelex can't know your components, the one guarantee it enforces is that
**nothing is dropped**: `renderForm` runs a completeness check up front and
throws if your inventory lacks a type-only catch-all for any `FieldType`, or names
a component with no composer. Cover every scalar and container type with a bare
`{ type: … }` entry. (`validateRenderer(renderer)` returns the gaps directly if
you want to check without rendering.)

## The handler contract

```typescript
interface Handler<T> {
  wire(form: T, controls: Control[], descriptor: FormDescriptor): T;
}
```

A handler has **no inventory** — it is uniform over controls, blind to which
components the renderer chose. It gets the rendered form, the flat list of
`Control`s (`{ field, key }`), and the descriptor, and returns wired output of the
same `T` (wrap-in-place). The default handler appends one script and reads
everything else from the DOM hooks the renderer stamped.

### The join, executed

When your server validates and returns Standard Schema issues, route them to
controls by path with the exported `route` helper — it matches a runtime issue
path (`tags.2.label`) to a control's template key (`tags.*.label`) by `*`
wildcard, and surfaces any issue that binds to nothing:

```typescript
import { route } from "@rafters/kelex";

const bindings = route(controls, issues); // Binding[] = { key, message, control? }
for (const b of bindings) {
  if (b.control) markError(b.control, b.message);
  else showFormLevelError(b.message); // unbound -- never dropped
}
```

(A browser handler that concretizes template rows can also match issue paths to
error slots directly; `route` is the canonical join and the one conformance
exercises.)

## Prove it with conformance

kelex can't test your components, but it can test the **contract** against the
schema space. `conformance` runs a battery of generated schemas plus a seeded
fuzzer and checks the invariants a plugin must honor — the floor, totality
(nothing hits `fallback`), path-preservation (every control path is stamped in
the output), determinism, and the handler join:

```typescript
import { conformance } from "@rafters/kelex";

const report = await conformance(myRenderer, myHandler, {
  // T is opaque to the engine, so tell it how to read stamped names out of your output
  names: (output) => extractNames(output),
});
if (!report.passed) console.error(report.failures); // { invariant, schema, detail }
```

Pass `{ types: ["string", "number", ...] }` to scope a run to a subset of field
types — useful while a renderer is still leaf-only.

## Packaging

Ship a plugin as its own package. The convention is
`@<org>/kelex-renderer-<kit>` (a renderer for a component kit) and
`@<org>/kelex-handler-<framework>` (a handler for a framework). Depend on
`@rafters/kelex` for the contract types and `conformance`; import nothing else.
