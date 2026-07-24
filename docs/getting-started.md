# Getting started

kelex turns a Zod schema into a form. It's a **plugin host**: you declare which
plugins to use in a config file, and kelex loads them and runs the pipeline —
the same way ESLint or Vite read a config and load the plugins named there.

## Install

Install the host, the plugins you want, and Zod:

```sh
pnpm add kelex @kelex/plugin-renderer-html @kelex/plugin-handler-post zod
```

- **`kelex`** — the host: introspection, the engine, the settings loader, the CLI.
- **`@kelex/plugin-renderer-html`** — the default renderer (schema → HTML).
- **`@kelex/plugin-handler-post`** — the default handler (HTML → async-POST behavior).

Zod 4 is a **peer dependency** — kelex reads your live schema graph. Node 24+.

> Not yet on npm; until then, build from source (`pnpm build`) and link it.

## Configure

Write a `kelex.settings.jsonc` in your project. It declares the plugins to load
and how to run:

```jsonc
{
  // The ONLY required settings: which plugins to import and load.
  "renderer": "@kelex/plugin-renderer-html",
  "handler": "@kelex/plugin-handler-post",

  // Optional: default options for the plugins (a run can override them).
  "renderer.options": { "action": "/api/submit" },
}
```

That's all the settings hold — _which plugins_. Everything else (the schema, the
output path, per-run options) is a **run-time** input, not baked into the config.
`.jsonc` allows comments and trailing commas.

## Generate

From the CLI — the schema is the argument, output and options are flags:

```sh
kelex form ./src/schema.ts -e signupSchema -o signup.html -a /api/signup
# ✓ Generated signup.html
#   renderer: @kelex/plugin-renderer-html + @kelex/plugin-handler-post
#   4 fields: email, displayName, plan, acceptTerms
#
#   -c/--config  -e/--export  -o/--out  -a/--action
#   -r/--renderer  -H/--handler   (override the settings' plugins)
```

kelex imports and **evaluates** the schema module to read the live Zod graph
(not source text), so only point it at a path you trust.

Or from code — pass the **live schema**; kelex loads `kelex.settings.jsonc` and
the plugins itself:

```typescript
import { z } from "zod/v4";
import { generateForm, writeForm } from "kelex";

const schema = z.object({ email: z.email(), name: z.string().min(2) });

const { output } = await generateForm(schema, {
  rendererOptions: { action: "/api/signup" }, // a run-time option
});
writeForm("signup.html", output);
```

Pass `{ config: "path.jsonc" }` for a different settings file, or `{ settings }`
to skip the file entirely.

## What you get

With the default plugins, an `email` field becomes `<input type="email"
required>`, a bounded number becomes a range slider, a nested object becomes a
`<fieldset>`, an array becomes an add/remove repeater, a discriminated union
becomes a variant switch. Every control carries `name` (its path), a unique
`id`, a `<label>`, and a path-addressed error slot. On submit, the handler runs
native HTML5 validation, collects typed values into nested JSON, and `POST`s to
the form's `action`.

Ship the renderer's example stylesheet, or copy and restyle it:

```typescript
import "@kelex/plugin-renderer-html/form.css";
```

## On the server

kelex ships **no** validation to the browser — the client gate is native HTML5
only. Validate on the server with the same schema (via Standard Schema) and
return the issues as JSON; the handler routes each to its control's error slot
by path.

```typescript
const result = await signupSchema["~standard"].validate(await req.json());
if (result.issues) return Response.json({ issues: result.issues });
// result.value is validated and typed
```

Number and boolean fields round-trip as JSON numbers/booleans. A `z.date()` posts
as a `YYYY-MM-DD` string — use `z.coerce.date()` on the server for those.

## Next

- Swap or build a plugin: [Writing plugins](./writing-plugins.md) — both surfaces,
  renderer and handler.
- The `composite` target still emits the raw `FormDescriptor` as JSON
  (`kelex generate <schema> -t composite`) if you'd rather own rendering entirely.
