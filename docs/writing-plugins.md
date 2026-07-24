# Writing plugins

kelex is a host. It folds a `FormDescriptor` through two plugin **surfaces** —
and it loads whichever ones your `kelex.settings.jsonc` names:

```typescript
renderForm(descriptor, renderer, handler?) // = handler ? wire(render(...), ...) : render(...)
```

- A **renderer plugin** turns the descriptor into output of some type `T` — an
  HTML string, a component tree, anything.
- A **handler plugin** wires that output — state, validation, submit — by control
  path.

They never call each other. They meet at one join: the descriptor's **canonical
path**. The renderer stamps each control's `name` with its path; the handler
routes validation issues back to controls by that same path. Build a renderer, a
handler, or both; mix a kit's renderer with someone else's handler.

The default `@kelex/plugin-renderer-html` and `@kelex/plugin-handler-post` are the
reference implementation. Read their source alongside this guide.

## The plugin contract (both surfaces)

Every plugin is its own package that **default-exports a factory**:

```typescript
// (options from settings) => the plugin
export default function create(options = {}) {
  /* return a Renderer or Handler */
}
```

The host resolves the package named in the settings from **your project**,
imports it, and calls that factory with the plugin's options. Depend on `kelex`
for the contract types (all type-only — erased at runtime) and import nothing
else private:

```typescript
import type { Renderer, Handler, Composer, Input, Entry, Control } from "kelex/engine";
```

Declare `kelex` and `zod` as peer dependencies and tag the package with the
`kelex-plugin` keyword so it's discoverable. The official plugins use the
`@kelex/plugin-<surface>-<name>` convention.

---

## Surface 1 — a renderer plugin

```typescript
interface Renderer<T> {
  inventory: Entry[]; // data: match a field -> a component
  compose: Record<string, Composer<T>>; // code: build T for a component
  form: (children: Child<T>[]) => T; // wrap the top-level fields
  fallback: Composer<T>; // a field no entry matched
}
```

### The inventory is data

The inventory is the **data half** — an ordered list of entries. Ship it as a
file (the default ships `inventory.jsonl`, one entry per line) and load it in the
factory, so it's editable on its own — by hand or a future UI — without touching
code:

```typescript
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Entry } from "kelex/engine";

function loadInventory(): Entry[] {
  return readFileSync(join(import.meta.dirname, "..", "inventory.jsonl"), "utf8")
    .split("\n")
    .filter((l) => l.trim() && !l.startsWith("//"))
    .map((l) => JSON.parse(l) as Entry);
}
```

`render` picks the **first** entry whose `match` a field satisfies, then calls the
composer named by that entry's `component`. Order is precedence — specializations
sit above the type-only catch-all:

```jsonl
{"match":{"type":"string","format":"email"},"component":"input","settings":{"type":"email"}}
{"match":{"type":"string","maxLength":{"gte":256}},"component":"textarea"}
{"match":{"type":"string"},"component":"input","settings":{"type":"text"}}
```

`Match` pins `type` and optionally narrows on `format`, a `.meta({ ui })` hint,
length/number buckets, or object field names. An entry's `settings` become the
composer's `config` after `$ref`s resolve from the field's own facts — `"$values"`
reads an enum's values, `{ "ref": "$maxLength", "default": 100 }` reads a
constraint or falls back. So a composer only ever sees final values.

### Composers and the five shapes

`render` walks the schema's own topology. Every field is one of five shapes, and
the composer receives an `Input<T>` telling it which:

| shape       | schema topology              | the `Input` carries                   |
| ----------- | ---------------------------- | ------------------------------------- |
| `control`   | a scalar (string, number, …) | just `field`, `key`, `config`         |
| `group`     | an object or tuple           | `children: Child<T>[]`                |
| `list`      | an array or record           | `item: Child<T>` (a `*` slot)         |
| `choice`    | a union                      | `variants: Variant<T>[]`              |
| `recursive` | a `z.lazy` boundary          | nothing below (the widget expands it) |

A `Child<T>` is `{ field, key, rendered }` — its subtree is **already rendered**
to `T`, so a composer just places `child.rendered`; it never recurses. `key` is
the canonical path (`tags.*.label`, with `*` for a template slot). Stamp it as the
control's `name` — that is the join the handler relies on.

```typescript
const compose: Record<string, Composer<string>> = {
  input: (i) => `<input name="${i.key}" type="${i.config.type ?? "text"}">`,
  group: (i) =>
    i.shape === "group" ? `<fieldset>${i.children.map((c) => c.rendered).join("")}</fieldset>` : "",
  // ...list, choice, recursive
};
```

### The floor

Because kelex can't know your components, the one guarantee it enforces is that
**nothing is dropped**: `renderForm` runs a completeness check up front and throws
if your inventory lacks a type-only catch-all for any `FieldType`, or names a
component with no composer. Cover every scalar and container type with a bare
`{ "type": … }` entry. (`validateRenderer(renderer)` from `kelex/engine` returns
the gaps if you want to check without rendering.)

### Package it

```typescript
import type { Renderer } from "kelex/engine";

export default function createRenderer(options: { action?: string } = {}): Renderer<string> {
  return { inventory: loadInventory(), compose, form: makeForm(options), fallback };
}
```

Ship the `inventory.jsonl` (and any assets like a stylesheet) in the package's
`files`. Point the settings' `renderer` at the package name.

---

## Surface 2 — a handler plugin

```typescript
interface Handler<T> {
  wire(form: T, controls: Control[], descriptor: FormDescriptor): T;
}
```

A handler has **no inventory** — it is uniform over controls, blind to which
components the renderer chose. It gets the rendered form, the flat list of
`Control`s (`{ field, key }`), and the descriptor, and returns wired output of the
same `T` (wrap-in-place). The default handler reads only the DOM hooks the
renderer stamped (`name`/`data-path`, error slots, `data-variant`, `data-add-row`,
…) — so any conforming renderer's output works.

### The join, executed

When your server validates and returns Standard Schema issues, route them to
controls by path with the `route` helper — it matches a runtime issue path
(`tags.2.label`) to a control's template key (`tags.*.label`) by `*` wildcard, and
surfaces any issue that binds to nothing:

```typescript
import { route } from "kelex/engine";

const bindings = route(controls, issues); // Binding[] = { key, message, control? }
for (const b of bindings) {
  if (b.control) markError(b.control, b.message);
  else showFormLevelError(b.message); // unbound -- never dropped
}
```

### Package it

```typescript
import type { Handler } from "kelex/engine";

export default function createHandler(options = {}): Handler<string> {
  return { wire: (form) => `${form}\n<script>${runtime}</script>` };
}
```

Point the settings' `handler` at the package name.

---

## Prove it with conformance

kelex can't test your components, but it can test the **contract** against the
schema space. `conformance` runs a battery of generated schemas plus a seeded
fuzzer and asserts the invariants a plugin must honor — the floor, totality
(nothing hits `fallback`), path-preservation (every control path is stamped in the
output), determinism, and the handler join:

```typescript
import { conformance } from "kelex/conformance";

const report = await conformance(myRenderer, myHandler, {
  // T is opaque to the engine, so tell it how to read stamped names out of your output
  names: (output) => extractNames(output),
});
if (!report.passed) console.error(report.failures); // { invariant, schema, detail }
```

Run it against your plugin(s) before you publish. Pass `{ types: ["string",
"number", …] }` to scope a run to a subset of field types — useful while a renderer
is still leaf-only.
