# Getting started

You already wrote the schema. This walks through pointing kelex at it and getting a form back.

## Install

```sh
pnpm add kelex @kelex/plugin-renderer-html @kelex/plugin-handler-post zod
```

Three packages: the host, a renderer, a handler. The host has no opinion about the last two; it loads whichever ones your settings name.

Zod 4 is a peer dependency. kelex imports and evaluates your schema module to read the live Zod graph, so point it only at paths you trust.

Not on npm yet. Until then, clone it, run `pnpm build`, and link it.

## Write the settings file

Put a `kelex.settings.jsonc` in your project root:

```jsonc
{
  // Which plugins to load. Only the renderer is required; without a handler
  // the form is plain markup with no script.
  "renderer": "@kelex/plugin-renderer-html",
  "handler": "@kelex/plugin-handler-post",

  // Optional: defaults for the plugins. A run can override them.
  "renderer.options": { "action": "/api/submit" },
}
```

That is the whole config. Which plugins, and their defaults. The schema and the output path are arguments, because they change per run and the plugins do not.

`.jsonc` means comments and trailing commas are legal.

## Generate a form

Start with a schema:

```typescript
// signup.ts
import { z } from "zod/v4";

export const signupSchema = z.object({
  email: z.email(),
  displayName: z.string().min(2).max(40),
  plan: z.enum(["free", "pro"]),
  acceptTerms: z.boolean(),
});
```

Run it:

```sh
$ kelex form ./signup.ts -e signupSchema -o signup.html -a /api/signup
✓ Generated signup.html
  renderer: @kelex/plugin-renderer-html + @kelex/plugin-handler-post
  4 fields: email, displayName, plan, acceptTerms
```

The schema path is the argument. Everything else is a flag.

| flag               | what it does                           |
| ------------------ | -------------------------------------- |
| `-e`, `--export`   | which export to read, if not default   |
| `-o`, `--out`      | where to write                         |
| `-a`, `--action`   | the form's `action`                    |
| `-c`, `--config`   | a settings file other than the default |
| `-r`, `--renderer` | override the settings' renderer        |
| `-H`, `--handler`  | override the settings' handler         |

## Read what came out

Here is the email field from that run, line-wrapped:

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

And the enum, which became a radio group:

```html
<div
  role="radiogroup"
  id="plan"
  aria-labelledby="plan-label"
  aria-describedby="plan-error"
  aria-invalid="false"
  data-path="plan"
>
  <span id="plan-label">Plan</span>
  <label for="plan-opt-0"
    ><input type="radio" id="plan-opt-0" name="plan" value="free" required />free</label
  >
  <label for="plan-opt-1"><input type="radio" id="plan-opt-1" name="plan" value="pro" />pro</label>
  <span id="plan-error" data-error-for="plan" role="alert" aria-live="polite"></span>
</div>
```

Three things are true of every control the default renderer emits. Its `name` is its canonical path. Its `id` is what the label points at. It has an empty error slot addressed by that same path.

That last one is the join. The renderer stamps the path; the handler finds the slot by it. Neither knows anything else about the other.

With the default plugins, a bounded number becomes a range slider, a nested object becomes a `<fieldset>`, an array becomes an add and remove repeater, and a discriminated union becomes a variant switch that disables the panels you did not pick.

## Drive it from code

Same thing without the CLI. Pass the live schema; kelex loads the settings and the plugins itself.

```typescript
import { z } from "zod/v4";
import { generateForm, writeForm } from "kelex";

const schema = z.object({ email: z.email(), name: z.string().min(2) });

const { output } = await generateForm<string>(schema, {
  rendererOptions: { action: "/api/signup" },
});
writeForm("signup.html", output);
```

Pass `{ config: "path.jsonc" }` to read a different settings file, or `{ settings }` to skip the file entirely. The type argument names what your renderer produces: `string` for the HTML defaults, a tree type for a renderer that builds one.

This path needs Node. It reads a file and resolves packages off disk.

## Drive it from a browser

Skip the host and call the engine. `kelex/introspection` and `kelex/engine` import nothing from Node, so they run wherever Zod runs.

```typescript
import { z } from "zod/v4";
import { introspect } from "kelex/introspection";
import { renderForm } from "kelex/engine";

const schema = z.object({ email: z.email(), name: z.string().min(2) });

const html = renderForm(introspect(schema, { formName: "Signup" }), renderer, handler);
document.querySelector("#mount").innerHTML = html;
```

You pass the renderer and handler yourself instead of naming them in a settings file, because there is no filesystem to resolve packages from. The handler argument is optional here even though the settings file requires one.

The catch is the inventory. A renderer that reads `inventory.jsonl` off disk will not load in a browser, so inline it or fetch it. Everything else in the fold is pure.

Regenerating on every keystroke works. `introspect` and `renderForm` hold no state between calls.

## Wire up the server

kelex ships no validation to the browser. The client gate is native HTML5 and nothing more, which means the only thing standing between a user and your database is your server.

Validate with the same schema you generated from:

```typescript
const result = await signupSchema["~standard"].validate(await req.json());
if (result.issues) return Response.json({ issues: result.issues });
// result.value is validated and typed
```

Return the issues as JSON and the handler routes each one to its control's error slot by path. An issue whose path matches no control goes to a form-level sink instead of disappearing.

Validating against the live schema rather than the descriptor is deliberate. It means your `.refine()` messages are the real ones and there is no second copy of the rules to drift.

Numbers and booleans round-trip as JSON numbers and booleans. A `z.date()` posts as a `YYYY-MM-DD` string, so reach for `z.coerce.date()` on the server.

## Style it

The default renderer is classless. It ships an example stylesheet you can use or replace:

```typescript
import "@kelex/plugin-renderer-html/form.css";
```

## Next

If the default HTML is not what you want, [write a renderer](./writing-plugins.md). If you want the descriptor and none of the rendering, run `kelex generate ./signup.ts -t composite -o form.json -s signupSchema` and take the JSON.
