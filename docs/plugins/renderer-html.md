# @rafters/kelex-renderer-html

The default renderer. Classless semantic HTML, zero dependencies, output type `string`.

Constraints on the schema become native validation attributes. Every control carries its path as `name`, which is the join the handler needs. The markup is inert: this plugin adds no behavior at all, and a handler owns every click.

```sh
pnpm add @rafters/kelex-renderer-html
```

```jsonc
{
  "renderer": "@rafters/kelex-renderer-html",
  "renderer.options": { "action": "/api/submit" },
}
```

## Options

| option   | type     | default                        | what it does                    |
| -------- | -------- | ------------------------------ | ------------------------------- |
| `action` | `string` | none, posts to the current URL | the `<form>` element's `action` |

## What it emits

From `z.email()`:

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

Every control gets the same four things: its path as `name`, an `id` the label points at, `data-path` for the handler, and an empty error slot addressed by that path.

From `z.enum(["free", "pro"])`, a radio group with `role="radiogroup"` and one `<input type="radio">` per value. Objects and tuples become `<fieldset>`. Arrays and records become a repeater with a `<template>` row and add and remove buttons. Unions become a `<select data-variant-of>` plus panels marked `data-variant` and `data-when`.

## The inventory

Nineteen entries, shipped as `inventory.jsonl` in the package, read at factory time. First match wins, so specializations sit above the catch-alls.

| match                         | component   | settings                         |
| ----------------------------- | ----------- | -------------------------------- |
| `string` + `ui: password`     | `input`     | `type: password`                 |
| `string` + `ui: otp`          | `input`     | numeric inputmode, one-time-code |
| `string` + `ui: tel`          | `input`     | `type: tel`                      |
| `string` + `format: email`    | `input`     | `type: email`                    |
| `string` + `format: url`      | `input`     | `type: url`                      |
| `string` + `maxLength >= 256` | `textarea`  | none                             |
| `number` + `bounded`          | `input`     | `type: range`                    |
| `string`                      | `input`     | `type: text`                     |
| `number`                      | `input`     | `type: number`                   |
| `boolean`                     | `checkbox`  | none                             |
| `date`                        | `input`     | `type: date`                     |
| `enum`                        | `enum`      | `values: $values`                |
| `literal`                     | `input`     | `type: hidden`, `value: $values` |
| `object`, `tuple`             | `group`     | none                             |
| `array`, `record`             | `list`      | none                             |
| `union`                       | `choice`    | none                             |
| `ref`                         | `recursive` | none                             |

The last twelve entries are the floor: one type-only entry per field type, so nothing can be dropped. The table pairs `object`/`tuple` and `array`/`record` on one row each; the file lists them separately.

Semantic specials use an explicit tag rather than pattern matching. `z.string().meta({ ui: "otp" })` gets the one-time-code treatment; a regex that happens to look like an OTP does not, because regex sources are not stable enough to match on.

## Styling

Classless, so it inherits whatever your stylesheet says about `input`, `label`, and `fieldset`. An example stylesheet ships with the package:

```typescript
import "@rafters/kelex-renderer-html/form.css";
```

Copy it and restyle rather than depending on it. It is an example, not a design system.

## In a browser

The factory reads `inventory.jsonl` off disk, so this package as shipped needs Node. To render in a browser, inline the inventory and build the renderer yourself from the same composers.

## Limits

A non-discriminated union gets positional placeholder names, because the schema carries no discriminator to name the variants. `z.union([z.string(), z.number()])` renders a selector reading `variant_0` and `variant_1` over members labelled `Option_0` and `Option_1`. Those are the real strings a user sees, so give the union a discriminator when the labels matter.

That selector is also presentational. Only a discriminated union's selector carries a `name`, so a non-discriminated one submits nothing about the choice; the handler disables the inactive panels, and the variant is implied by which fields arrive.

`$ref` settings copy a fact off the field. They do not compute one. A slider's `step` cannot be derived from its bounds in the inventory and has to come from a composer.
