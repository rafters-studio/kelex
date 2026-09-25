# kelex

Zod schema in, form out. One CLI, two plugins.

No opinion about your framework. No values kelex did not read out of your schema. No validation shipped to the browser.

> Status: pre-release. The host, the plugin contract, and the two default plugins are built and tested. Not on npm yet, so build from a checkout.

## Show it running

A schema you already wrote:

```typescript
import { z } from "zod/v4";

export const signupSchema = z.object({
  email: z.email(),
  displayName: z.string().min(2).max(40),
  plan: z.enum(["free", "pro"]),
  acceptTerms: z.boolean(),
});
```

One command:

```sh
$ kelex form ./signup.ts -e signupSchema -o signup.html -a /api/signup
✓ Generated signup.html
  renderer: @kelex/plugin-renderer-html + @kelex/plugin-handler-post
  4 fields: email, displayName, plan, acceptTerms
```

What lands in `signup.html`, one field of it, line-wrapped to read:

```html
<div>
  <label for="email">Email</label>
  <input
    type="email"
    name="email"
    id="email"
    data-path="email"
    aria-invalid="false"
    aria-describedby="email-error"
    required
  />
  <span id="email-error" data-error-for="email" role="alert" aria-live="polite"></span>
</div>
```

`z.email()` became `type="email"` and `required`. `.min(2).max(40)` became `minlength` and `maxlength`. The enum became a radio group with `role="radiogroup"`. Every control carries its path as `name`, an `id` its label points at, and an empty error slot the handler fills when the server rejects something.

kelex read all of that off the schema. It added nothing.

## Install

```sh
pnpm add kelex @kelex/plugin-renderer-html @kelex/plugin-handler-post zod
```

Zod 4 is a peer dependency, because kelex reads your live schema graph rather than your source text. Node 24 or newer.

## Configure

The settings file names the plugins. That is all it holds.

```jsonc
{
  "renderer": "@kelex/plugin-renderer-html",
  "handler": "@kelex/plugin-handler-post",
}
```

Only `renderer` is required. Leave `handler` out and you get the renderer's markup with no script, ready to serve as static HTML.

The schema, the output path, and per-run options are arguments, not config. Nothing about a particular form belongs in this file.

## Or run it in code

The CLI is one way in. There are two others.

On Node, `generateForm` does what the CLI does. It reads the settings file, resolves the plugins, and hands back the output.

```typescript
import { generateForm, writeForm } from "kelex";

const { output } = await generateForm<string>(schema, {
  rendererOptions: { action: "/api/signup" },
});
writeForm("signup.html", output);
```

In a browser, skip the settings file and call the engine directly. `kelex/introspection` and `kelex/engine` import nothing from Node, so they run wherever Zod runs.

```typescript
import { introspect } from "kelex/introspection";
import { renderForm } from "kelex/engine";

const html = renderForm(introspect(schema, { formName: "Signup" }), renderer, handler);
document.querySelector("#mount").innerHTML = html;
```

The difference is where the renderer comes from. On Node the host resolves it by package name off disk. In a browser you import it and pass it, and its inventory has to be inlined or fetched rather than read off the filesystem.

That is the whole portability story. Introspection and the fold are pure. The CLI, the settings loader, and reading an inventory file are not.

## The two plugins

kelex introspects the schema into a `FormDescriptor`, then folds it through a renderer and a handler. They never call each other. They meet on one thing: the descriptor's canonical path, stamped as each control's `name`.

| plugin     | job                               | made of                                   |
| ---------- | --------------------------------- | ----------------------------------------- |
| `Renderer` | descriptor to output of some type | an inventory (data) plus composers (code) |
| `Handler`  | wire that output                  | one `wire` function, no inventory         |

Swap either half. Two ship today and more are planned; see [the plugin catalog](./docs/plugins/index.md). To write your own, start with [writing a plugin](./docs/writing-plugins.md).

## What kelex guarantees

One thing: nothing gets dropped. Before rendering, `renderForm` checks that your inventory answers every field type and that every component it names has a composer. If it does not, kelex throws instead of quietly skipping a field.

Everything else is your call. kelex cannot test your components, so it tests the contract against the schema space instead:

```typescript
import { conformance } from "kelex/conformance";
import createRenderer from "@kelex/plugin-renderer-html";
import createHandler from "@kelex/plugin-handler-post";

const report = await conformance(createRenderer(), createHandler(), {
  names: (html) => [...html.matchAll(/name="([^"]+)"/g)].map((m) => m[1]),
});
report.passed; // true
```

A shape battery plus a seeded fuzzer, asserting the floor, totality, path preservation, determinism, and the handler join.

## On the server

kelex ships no validation to the browser. The client gate is native HTML5. Validate on the server with the same schema and return the issues; the handler routes each one to its control by path.

```typescript
const result = await signupSchema["~standard"].validate(await req.json());
if (result.issues) return Response.json({ issues: result.issues });
```

Numbers and booleans round-trip as JSON numbers and booleans. A `z.date()` posts as a `YYYY-MM-DD` string, so use `z.coerce.date()` on the server for those.

## If you would rather render it yourself

Take the descriptor as JSON and ignore the plugins:

```sh
kelex generate ./signup.ts -t composite -o form.json -s signupSchema
```

That is the same contract editors and non-JavaScript readers consume.

## What it reads

| construct                                                                                    | notes                                            |
| -------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| `string`, `number`, `boolean`, `date`, `enum`, `literal`                                     | scalars                                          |
| `object`, `array`, `tuple`, `record`, `union`, `discriminatedUnion`                          | containers, nested                               |
| `z.lazy`, getter recursion                                                                   | recursive schemas                                |
| `optional`, `nullable`, `default`, `catch`, `readonly`                                       | wrappers, peeled; inner constraints survive      |
| `describe`, `meta`                                                                           | labels and `ui` hints                            |
| `min`/`max`, `minLength`/`maxLength`, `.length()`, `regex`, formats, `startsWith`/`endsWith` | carried onto the descriptor, gt vs gte preserved |
| `refine`, `superRefine`, `check`                                                             | recorded as present, not reasoned through        |
| `transform`, `pipe`                                                                          | input side read; output side not represented     |

Field order is preserved. Anything the reader cannot represent is reported as a [warning](./docs/warnings.md), never dropped in silence. [Schemas](./docs/schemas.md) has the full list, how labels are derived, and how to generate schemas for kelex from another language.

## Packages

| package                                                          | what it is                                          |
| ---------------------------------------------------------------- | --------------------------------------------------- |
| `kelex`                                                          | the host: introspection, engine, settings, CLI      |
| [`@kelex/plugin-renderer-html`](./docs/plugins/renderer-html.md) | default renderer, classless HTML, zero dependencies |
| [`@kelex/plugin-handler-post`](./docs/plugins/handler-post.md)   | default handler, async POST, no framework           |

Renderers for rafters and shadcn are planned, as are handlers for nanostores, zustand, TanStack Form, and React Hook Form. The [catalog](./docs/plugins/index.md) tracks what ships and what does not.

Entry points are explicit: `kelex/engine`, `kelex/introspection`, `kelex/conformance`, `kelex/targets`, `kelex/schema-writer`. Plugins depend on the public contract and nothing else.

## Docs

[Getting started](./docs/getting-started.md) walks the install, the settings file, the CLI, and the server side. [Plugins](./docs/plugins/index.md) lists what is available and documents each one. [Writing a plugin](./docs/writing-plugins.md) builds a renderer from scratch. [Plugin reference](./docs/plugin-reference.md) holds the match keys, input shapes, and the floor.

## Development

pnpm only. `pnpm test` runs the unit tests with no build; `pnpm build` then `pnpm test:all` adds the integration specs. `pnpm flightcheck` before a PR. oxlint and oxfmt, TypeScript 7, tsdown, vitest.

## License

MIT. All of it.
