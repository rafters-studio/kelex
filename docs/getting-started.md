# Getting started

kelex turns a Zod schema into a working form. This guide covers the fast path —
a schema to a wired HTML form — and the second path, a `FormDescriptor` you
render yourself.

## Install

```sh
pnpm add @rafters/kelex zod
```

Zod 4 is a **peer dependency** — kelex reads your live schema graph, so you and
kelex share one Zod. Node 24+.

> Not yet on npm; until then, build from source (`pnpm build`) and link it.

## A schema to a working form

Three calls: introspect the schema, then render + wire it with the two default
plugins.

```typescript
import { z } from "zod/v4";
import { introspect, renderForm, htmlRenderer, postHandler } from "@rafters/kelex";

const signupSchema = z.object({
  email: z.email(),
  displayName: z.string().min(2).max(40),
  plan: z.enum(["free", "pro", "team"]),
  acceptTerms: z.boolean(),
});

const descriptor = introspect(signupSchema, {
  formName: "SignupForm",
  schemaImportPath: "./schema",
  schemaExportName: "signupSchema",
});

const html = renderForm(descriptor, htmlRenderer, postHandler);
```

`html` is a complete `<form>`: classless, semantic markup with native validation
attributes derived from the schema, plus a submit script the handler appended.

Ship the example stylesheet alongside it (or copy it and restyle):

```typescript
import "@rafters/kelex/form.css";
```

### What you get

- `email` → `<input type="email" required>`; `displayName` → a text input with
  `minlength="2" maxlength="40"`; `plan` → a radio group; `acceptTerms` → a
  checkbox. A nested object becomes a `<fieldset>`, an array becomes an
  add/remove repeater, a discriminated union becomes a variant switch.
- Every control carries `name` (its path), a unique `id`, a `<label>`, and an
  empty error slot addressed by the same path.
- On submit, the handler lets the browser run native HTML5 validation, collects
  the values (typed — numbers as numbers, checkboxes as booleans) into nested
  JSON, and `POST`s it to the form's `action`.

Set the POST target with the renderer factory:

```typescript
import { createHtmlRenderer } from "@rafters/kelex";
const renderer = createHtmlRenderer({ action: "/api/signup" });
const html = renderForm(descriptor, renderer, postHandler);
```

### On the server

kelex ships **no** validation to the browser — the client gate is native HTML5
only. Do the real validation on the server with the same schema (via Standard
Schema) and return the issues as JSON; the handler routes each one to its
control's error slot by path.

```typescript
// POST /api/signup
const result = await signupSchema["~standard"].validate(await req.json());
if (result.issues) {
  return Response.json({ issues: result.issues }); // -> routed to fields by path
}
// ... result.value is validated and typed
```

A field of type `z.number()`/`z.boolean()` round-trips as a JSON number/boolean,
so it validates without coercion. A `z.date()` posts as a `YYYY-MM-DD` string —
use `z.coerce.date()` on the server for those.

## The other path: a FormDescriptor

If you want to own rendering, take the descriptor as JSON via the `composite`
target — the same contract editors and non-JS readers consume.

```typescript
import { generate, compositeTarget } from "@rafters/kelex";

const { files, warnings } = generate({
  schema: signupSchema,
  formName: "SignupForm",
  schemaImportPath: "./schema",
  schemaExportName: "signupSchema",
  target: compositeTarget,
});
```

Or from the CLI:

```sh
kelex generate ./schema.ts -t composite -o form.json -s signupSchema
```

The schema module is imported and **evaluated** at generate time (kelex reads the
live graph, not source text), so only point it at a path you trust.

## Next

- Write your own renderer or handler: [Writing plugins](./writing-plugins.md).
- Prove a plugin honors the contract with the `conformance` harness (also in the
  plugin guide).
