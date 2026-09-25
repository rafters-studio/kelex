# @kelex/plugin-handler-post

The default handler. Async POST, no framework, output type `string`.

It appends a self-contained script to the rendered form and returns the same string. No dependencies, no build step, no runtime library. It reads only the DOM hooks the renderer stamped, so it works with any renderer that emits HTML strings and stamps paths.

```sh
pnpm add @kelex/plugin-handler-post
```

```jsonc
{
  "handler": "@kelex/plugin-handler-post",
}
```

## Options

None. The factory ignores whatever you pass it, so `handler.options` does nothing for this plugin. The form's POST target comes from the renderer's `action`, not from here.

## What it does

On submit it runs native HTML5 validation first and stops if the browser rejects the form. Then it collects the values into nested JSON and POSTs them to the form's `action`.

Values arrive typed rather than as FormData strings. A number input posts a number, a checkbox posts a boolean, and a blank optional field is omitted instead of posting an empty string. A date posts as a `YYYY-MM-DD` string, because JSON has no date, which is why the server wants `z.coerce.date()` for those.

Nested paths become nested JSON. A control named `address.city` lands at `{ address: { city } }`, and `tags.0.label` lands in an array.

## Routing errors back

Your server validates and returns the issues:

```typescript
const result = await signupSchema["~standard"].validate(await req.json());
if (result.issues) return Response.json({ issues: result.issues });
```

The script matches each issue's path to the control with that `name`, writes the message into that control's error slot, and sets `aria-invalid="true"`. An issue whose path matches no control goes to a form-level sink that the script creates if the renderer did not provide one, so a root-level `.refine()` message is visible rather than lost.

Validation runs against your live Zod schema on the server, not against the descriptor. Your custom `.refine()` messages are the real ones and there is no second copy of the rules to drift.

## What it does not do

It ships no validation to the browser. The client gate is native HTML5 and nothing more. Zod never reaches the client.

That is a deliberate trade. You get a form with no JavaScript payload beyond this script, and you get one place where the rules live. You do not get instant client-side feedback on a `.refine()` before the round trip.

## Hooks it reads

| hook                              | where it comes from     | what it does                              |
| --------------------------------- | ----------------------- | ----------------------------------------- |
| `data-kelex-post`                 | stamped by this handler | marks a form for initialization           |
| `name`                            | the renderer            | the path, used to collect and to route    |
| `data-error-for`                  | the renderer            | the error slot for that path              |
| `data-variant-of`                 | the renderer            | a union selector                          |
| `data-variant`, `data-when`       | the renderer            | union panels and the value that shows one |
| `data-add-row`, `data-remove-row` | the renderer            | repeater controls                         |

Inactive union panels are hidden and their inputs disabled, so the browser neither submits them nor blocks validation on a required field nobody can see.

Repeater rows clone the renderer's `<template>` and re-index the paths and ids by a counter that never reuses a number, so removing a row cannot collide with a later add. Gaps are compacted when the values are collected.

## Multiple forms

It initializes every form marked `data-kelex-post` on the page, once each, and is safe to include more than once.
