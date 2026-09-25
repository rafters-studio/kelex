# Writing a plugin

kelex does not know how to draw anything. It reads your schema into a `FormDescriptor` and hands that to two plugins you choose. A renderer turns the descriptor into output. A handler wires that output up.

This page builds a renderer from nothing, one runnable step at a time. For the lookup tables, see the [plugin reference](./plugin-reference.md).

## The smallest renderer that runs

A renderer is four things: an inventory that maps a field to a component name, the composers that build output for those names, a wrapper for the whole form, and a fallback.

Here is one, complete. Save it as `tiny.mjs` in a project with `kelex` and `zod` installed, then run it.

```javascript
import { z } from "zod/v4";
import { introspect } from "kelex/introspection";
import { renderForm } from "kelex/engine";

const SCALARS = ["string", "number", "boolean", "date", "enum", "literal"];
const CONTAINERS = ["object", "array", "union", "tuple", "record", "ref"];

const inventory = [
  ...SCALARS.map((type) => ({ match: { type }, component: "field" })),
  ...CONTAINERS.map((type) => ({ match: { type }, component: "box" })),
];

const compose = {
  field: (i) => `<label>${i.field.label}<input name="${i.key}"></label>`,
  box: (i) => {
    const kids =
      i.shape === "group"
        ? i.children.map((c) => c.rendered).join("")
        : i.shape === "list"
          ? i.item.rendered
          : i.shape === "choice"
            ? i.variants.map((v) => v.children.map((c) => c.rendered).join("")).join("")
            : "";
    return `<fieldset><legend>${i.field.label}</legend>${kids}</fieldset>`;
  },
};

const renderer = {
  inventory,
  compose,
  form: (children) => `<form>${children.map((c) => c.rendered).join("")}</form>`,
  fallback: (i) => `<!-- no entry for ${i.key} -->`,
};

const schema = z.object({
  email: z.email(),
  displayName: z.string().min(2),
  plan: z.enum(["free", "pro"]),
});

console.log(renderForm(introspect(schema, { formName: "Signup" }), renderer));
```

```sh
$ node tiny.mjs
<form><label>Email<input name="email"></label><label>Display Name<input name="displayName"></label><label>Plan<input name="plan"></label></form>
```

Forty lines and it renders. Everything after this is refinement.

## Why twelve inventory entries

kelex makes exactly one guarantee: it will not drop a field. To keep that promise it checks your inventory before rendering and throws if any field type has no entry that matches on type alone.

Twelve types need a catch-all: `string`, `number`, `boolean`, `date`, `enum`, `literal`, `object`, `array`, `union`, `tuple`, `record`, `ref`.

A constrained entry does not count. An entry matching `string` plus a length bucket proves you handled long strings, not that you handled strings. That is why the example maps every type before it does anything clever.

Check without rendering:

```javascript
import { validateRenderer } from "kelex/engine";
console.log(validateRenderer(renderer)); // [] when complete
```

Pass a subset while you are still building: `validateRenderer(renderer, ["string", "number"])`. A leaf-only renderer can prove itself against scalars without owning containers yet.

## Order is precedence

The first entry whose `match` a field satisfies wins. Specializations go above the catch-all, never below it:

```jsonl
{"match":{"type":"string","format":"email"},"component":"input","settings":{"type":"email"}}
{"match":{"type":"string","maxLength":{"gte":256}},"component":"textarea"}
{"match":{"type":"string"},"component":"input","settings":{"type":"text"}}
```

Put the bare `{"type":"string"}` first and nothing below it ever matches. There is no specificity scoring to save you; the list is read top to bottom and the first hit claims the field.

An entry's `settings` reach the composer as `i.config` with any `$ref` already resolved against the field, so a composer only ever sees final values. Refs copy; they do not compute. There is no arithmetic in the inventory.

## Ship the inventory as data

The example builds the inventory in JavaScript because that is the shortest thing that runs. Real renderers ship it as a file:

```javascript
import { readFileSync } from "node:fs";
import { join } from "node:path";

function loadInventory() {
  return readFileSync(join(import.meta.dirname, "..", "inventory.jsonl"), "utf8")
    .split("\n")
    .filter((l) => l.trim() && !l.startsWith("//"))
    .map((l) => JSON.parse(l));
}
```

Data rather than code is the point. A JSONL inventory can be read by a plugin author who does not write TypeScript, which is the whole reason a Rails or Laravel renderer is possible. It also means a component catalog that grows on someone else's schedule does not require editing a switch statement in your source.

`import.meta.dirname` needs Node 20.11 or newer, and an ESM package.

## The five shapes

Your composer receives an `Input` telling it which shape the field is. The example handles three of them and returns an empty string for the rest, which is fine for a first pass and wrong for a real renderer.

| shape       | schema topology     | what the input carries      |
| ----------- | ------------------- | --------------------------- |
| `control`   | a scalar            | `field`, `key`, `config`    |
| `group`     | an object or tuple  | `children`                  |
| `list`      | an array or record  | `item`, a `*` template slot |
| `choice`    | a union             | `variants`                  |
| `recursive` | a `z.lazy` boundary | nothing below it            |

Children arrive already rendered. A `Child` is `{ field, key, rendered }` and your composer places `child.rendered` where it belongs. You never recurse; kelex already did.

## Where the example is wrong

The `choice` branch above renders every variant at once and renders the discriminator as an ordinary field. Both are bugs, and they are the reason unions deserve a real composer rather than a fold over children.

A union is exclusive. One variant is live and the rest must be hidden and disabled, or the browser will submit fields the user never filled and native validation will block on a control nobody can see. The discriminator is the selector that chooses between panels, not a text input.

The default HTML renderer solves this with a `<select data-variant-of>` plus panels marked `data-variant` and `data-when`, and the handler disables the inactive ones. Read `packages/plugin-renderer-html/src/containers.ts` before you write your own.

## Use the label with care

`i.field.label` is the field's `meta.title` when the schema author set one, and otherwise a label kelex derived from the key (`displayName` becomes `Display Name`). `i.field.meta?.title !== undefined` tells you which. An authored label is a decision; render it as written. A derived label is a guess; replace it if your renderer has a better one. [Schemas](./schemas.md#labels-authored-or-derived) has more.

## Stamp the path

The `key` on every input is the field's canonical path: `email`, `tags.*.label`, `address.city`. The `*` marks a template slot in a repeater.

Put it on the control as `name`. That single line is the entire contract between the two plugins:

```javascript
field: (i) => `<input name="${i.key}">`,
```

The renderer stamps the path. The handler finds the control by that path when the server sends back an issue. Neither knows anything else about the other, which is why you can pair a renderer with a handler that was written years later by someone else.

## Package it

A plugin is its own package that default-exports a factory. The host resolves the package name from your project, imports it, and calls the factory with whatever options the settings gave it.

```javascript
export default function createRenderer(options = {}) {
  return { inventory: loadInventory(), compose, form: makeForm(options), fallback };
}
```

Declare `kelex` and `zod` as peer dependencies, tag the package with the `kelex-plugin` keyword, and list `inventory.jsonl` in `files` so it ships. The official ones are named `@kelex/plugin-renderer-html` and `@kelex/plugin-handler-post`, so yours would be `@kelex/plugin-renderer-shadcn` or `plugin-handler-zustand`.

Then name it in the settings:

```jsonc
{
  "renderer": "my-renderer",
  "handler": "@kelex/plugin-handler-post",
}
```

`handler` is optional. A renderer-only project names only `renderer` and gets the renderer's markup, unwired.

## Writing a handler instead

A handler has no inventory. It gets the rendered form, a flat list of controls, and the descriptor, and returns output of the same type.

```javascript
export default function createHandler(options = {}) {
  return { wire: (form, controls, descriptor) => `${form}\n<script>${runtime}</script>` };
}
```

It is blind to components on purpose. It reads only the hooks the renderer stamped, which is why any conforming renderer works with any conforming handler.

When your server returns Standard Schema issues, match them to controls with `route`:

```javascript
import { route } from "kelex/engine";

for (const b of route(controls, issues)) {
  if (b.control) markError(b.control, b.message);
  else showFormLevelError(b.message);
}
```

`route` matches a runtime path like `tags.2.label` to a template key like `tags.*.label`, and hands back anything that bound to nothing so you can show it rather than swallow it.

Note that `route` is a real import, not a type. A handler that uses it needs `kelex` at runtime, unlike a renderer that only imports types.

## Prove it

kelex cannot test your components. It can test the contract against the whole schema space, which is the part you are most likely to get wrong.

```javascript
import { conformance } from "kelex/conformance";

const report = await conformance(myRenderer, myHandler, {
  names: (output) => extractNames(output),
});
if (!report.passed) console.error(report.failures);
```

The `names` function tells kelex how to read stamped paths back out of your output, because your output type is opaque to it. A shape battery plus a seeded fuzzer then check the floor, totality, path preservation, determinism, and the handler join.

Run it before you publish. Scope it with `{ types: ["string", "number"] }` while the renderer is still leaf-only.
