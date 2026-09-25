# Plugin reference

Lookup tables for the plugin contract. To build one, start with [writing a plugin](./writing-plugins.md).

Import the types from `kelex/engine`. They are type-only and erase at runtime, except `route` and `validateRenderer`, which are real functions.

```typescript
import type { Renderer, Handler, Composer, Input, Entry, Control } from "kelex/engine";
```

## The load contract

A plugin package default-exports a factory:

```typescript
type PluginFactory<T> = (options?: Record<string, unknown>) => T | Promise<T>;
```

The host reads the package name from `kelex.settings.jsonc`, resolves it from your project rather than from kelex, imports it, and calls the factory with the merged options. Settings options come first and per-run options override them.

Resolution starts at the directory that holds the settings file, so run the CLI from anywhere. When you pass `settings` as an object to `generateForm`, there is no file, so resolution starts at the current working directory. Pass `from` to choose the directory yourself.

`renderer` and `handler` name packages (`name` or `@scope/name`), not file paths. A plugin can ship as ESM or CommonJS. kelex reads an `exports` map the way Node does for `import()`, taking the first of `import`, `node`, or `default` in the package's own key order. If the whole map has no target for those, kelex reads it again with `require` too, so a package that exports only a CommonJS entry still loads. That is the one place kelex is looser than a bare `import()`. Without `exports`, `main` gets Node's CommonJS lookup, so `lib/index` and a directory both work. A TypeScript-compiled CommonJS default export (`exports.default = factory`) loads too.

The host checks what the factory returns before using it. A renderer needs `inventory` (an array), `compose` (an object), and `form` and `fallback` (functions); a handler needs `wire` (a function). A missing or mistyped member fails at load time, naming the package and the member. The factory may be async; kelex awaits it, and a factory that throws or rejects fails naming the package.

## Settings keys

| key                | required | what it holds                           |
| ------------------ | -------- | --------------------------------------- |
| `renderer`         | yes      | renderer package name                   |
| `handler`          | no       | handler package name                    |
| `renderer.options` | no       | defaults passed to the renderer factory |
| `handler.options`  | no       | defaults passed to the handler factory  |

Only `renderer` is required. Leave `handler` out and the form is the renderer's markup, unwired: static HTML with no script. A key with the wrong type fails when the settings load, naming the key.

## Renderer

```typescript
interface Renderer<T> {
  inventory: Entry[];
  compose: Record<string, Composer<T>>;
  form: (children: Child<T>[]) => T;
  fallback: Composer<T>;
}
```

## Entry

```typescript
interface Entry {
  match: Match;
  component: string;
  settings?: Record<string, Setting>;
}
```

First match in list order wins. There is no specificity scoring.

## Match keys

`type` is required. Everything else narrows.

| key         | type        | matches on                                                    |
| ----------- | ----------- | ------------------------------------------------------------- |
| `type`      | `FieldType` | the schema node type                                          |
| `format`    | `string`    | a string's format: `email`, `url`, `uuid`, and so on          |
| `ui`        | `string`    | a `.meta({ ui })` hint: `otp`, `password`, and so on          |
| `minLength` | `Bound`     | a length bucket, read from `length` or `minLength`            |
| `maxLength` | `Bound`     | a length bucket, read from `length` or `maxLength`            |
| `bounded`   | `boolean`   | true when a number has both a min and a max                   |
| `hasFields` | `string[]`  | an object carrying at least these field names, for composites |

A `Bound` is any of `gt`, `gte`, `lt`, `lte`, each a number.

Matching on a regex source is not supported. Regex sources are unstable across equivalent patterns, so use a `.meta({ ui })` tag for semantic specials instead.

## Field types

Twelve, and each needs a type-only catch-all entry or `renderForm` throws.

`string`, `number`, `boolean`, `date`, `enum`, `literal`, `object`, `array`, `union`, `tuple`, `record`, `ref`

```typescript
validateRenderer(renderer); // string[] of gaps, empty when complete
validateRenderer(renderer, ["string", "number"]); // scope to a subset while building
```

## Settings and refs

```typescript
type Setting = unknown | { ref: `$${string}`; default: unknown };
```

A literal passes through. A `$ref` reads a fact off the field before the composer sees it, so `i.config` holds final values only. Use the bare string form for a fact that is always present and the object form when you need a fallback:

```jsonl
{"match":{"type":"enum"},"component":"select","settings":{"options":"$values"}}
{"match":{"type":"number"},"component":"range","settings":{"max":{"ref":"$maxLength","default":100}}}
```

Refs copy. They do not compute. There is no arithmetic in the inventory, which is why a derived value like a slider step has to be handled in the composer.

## Input shapes

```typescript
type Input<T> = { field: FieldDescriptor; key: string; config: Config } & (
  | { shape: "control" }
  | { shape: "group"; children: Child<T>[] }
  | { shape: "list"; item: Child<T> }
  | { shape: "choice"; variants: Variant<T>[] }
  | { shape: "recursive" }
);
```

| shape       | schema topology   | extra members |
| ----------- | ----------------- | ------------- |
| `control`   | scalar            | none          |
| `group`     | object or tuple   | `children`    |
| `list`      | array or record   | `item`        |
| `choice`    | union             | `variants`    |
| `recursive` | `z.lazy` boundary | none          |

A `Child<T>` is `{ field, key, rendered }`, already folded. A `Variant<T>` is `{ value, label?, children }`.

Every field carries `key`, its canonical path. Stamp it as the control's `name`.

## Handler

```typescript
interface Handler<T> {
  wire(form: T, controls: Control[], descriptor: FormDescriptor): T;
}
```

A `Control` is `{ field, key }`. No inventory, because a handler is uniform over controls and blind to components.

## Routing issues

```typescript
route(controls: Control[], issues): Binding[]  // { key, message, control? }
```

Matches a runtime issue path such as `tags.2.label` to a template key such as `tags.*.label` by wildcard. A binding with no `control` is an issue that bound to nothing; show it at form level rather than dropping it.

## Conformance

```typescript
const report = await conformance(renderer, handler, options);
```

| option      | default  | what it does                             |
| ----------- | -------- | ---------------------------------------- |
| `names`     | required | reads stamped paths out of your output   |
| `types`     | all      | scope the run to a subset of field types |
| `seed`      | `1`      | fuzzer seed, so a failure reproduces     |
| `fuzzCount` | `25`     | how many random schemas to fuzz          |

The report is `{ passed, failures, coverage }`, where each failure is `{ invariant, schema, detail }`.

Invariants checked: the floor, totality so nothing reaches `fallback`, path preservation, determinism, and the handler join.

## Naming

A renderer is named `plugin-renderer-<name>` and a handler `plugin-handler-<name>`, matching `@kelex/plugin-renderer-html` and `@kelex/plugin-handler-post`. Tag yours with the `kelex-plugin` keyword and declare `kelex` and `zod` as peer dependencies.
