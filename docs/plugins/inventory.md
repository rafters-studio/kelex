# Plugin inventory — schema, required, complete

> Draft. The inventory is the **data half** of a renderer plugin: a flat table
> that maps an expectation over descriptor facts to a component + settings.
> kelex matches each descriptor node to the **most specific** entry it
> satisfies, then hands `{component, settings}` to the plugin's composer.
> kelex validates the inventory against these lists at **plugin load** and
> rejects an incomplete one loudly — completeness is required, correctness is not.

## Entry schema

```
Entry {
  match:      Match                          // predicate over descriptor facts
  component:  string                         // the renderer's component name (leaf OR container)
  settings?:  Record<string, Static | Ref>   // props for the component
}

Ref     = "$" + <fact>        // pulls a value from the matched field: "$length", "$label", "$pattern"
Static  = string | number | boolean
Range   = { eq? | gte? | lte? | gt? | lt? }  // numeric/length/date thresholds
```

- **`match`** must pin `type`; every other fact is optional. **Specificity = number of
  facts pinned.** Ties broken by explicit `priority?` (higher wins), else load error.
- **`settings`** are static values, or `$refs` that kelex resolves from the field before
  calling the composer (so the plugin only ever sees final props). e.g. `input-otp` sets
  `"maxLength": "$length"`.

Example, grounded in the rafters kit:

```jsonl
{"match":{"type":"string","length":{"gte":6,"lte":8},"pattern":"^[A-Za-z0-9]+$"},"component":"input-otp","settings":{"maxLength":"$length","pattern":"^[A-Za-z0-9]$"}}
{"match":{"type":"string","format":"email"},"component":"input","settings":{"type":"email"}}
{"match":{"type":"string","maxLength":{"gte":256}},"component":"textarea"}
{"match":{"type":"string"},"component":"input","settings":{"type":"text"}}
{"match":{"type":"number"},"component":"input","settings":{"type":"number"}}
{"match":{"type":"boolean"},"component":"checkbox"}
{"match":{"type":"enum"},"component":"select"}
{"match":{"type":"object"},"component":"fieldset"}
{"match":{"type":"array"},"component":"repeater"}
```

## Complete list — every fact you _may_ match on

The full surface kelex exposes, by type. An entry pins `type` plus any subset. This is the
ceiling: a plugin may map as deep as it likes toward it.

**Any type** — `type` (required), `optional`, `nullable`, `hasDefault`.

| type      | facts available to `match`                                                                                           |
| --------- | -------------------------------------------------------------------------------------------------------------------- |
| `string`  | `format` (email\|url\|uuid\|cuid\|datetime), `length`, `minLength`, `maxLength`, `pattern`, `startsWith`, `endsWith` |
| `number`  | `min`, `max`, `minExclusive`, `maxExclusive`, `isInt`, `step`                                                        |
| `boolean` | — (type only)                                                                                                        |
| `date`    | `minDate`, `maxDate`                                                                                                 |
| `enum`    | `values` (count / membership)                                                                                        |
| `literal` | `values` (count / membership)                                                                                        |
| `object`  | `fields` (shape predicate — matches a whole subtree → a composite)                                                   |
| `array`   | `element.type`, `minItems`, `maxItems`                                                                               |
| `union`   | `discriminator` (present/name), `variants` (count)                                                                   |
| `tuple`   | `elements` (count / positional types)                                                                                |
| `record`  | `value.type`                                                                                                         |

Numeric/length/date facts take a `Range` (`{eq,gte,lte,gt,lt}`); `pattern`/`format`/string
facts take a literal.

## Required list — the floor kelex validates at load

The inventory floor is **per-`FieldType`**, not per-role (unlike composers, which are
`{field, container}`). Reason: nesting has only two topologies, but each _type_ wants a
different sensible default control — a number is not a checkbox — so "one leaf fallback for
everything" is complete but useless. The required floor is a **type-only catch-all for every
`FieldType`**, so no field of any kind is ever unmatched:

Leaves — `string`, `number`, `boolean`, `date`, `enum`, `literal`
Containers — `object`, `array`, `union`, `tuple`, `record`

**11 entries.** Miss any one → load fails (a field of that type would fall through). Every
entry that pins more than `type` (email, otp, ranges, shape composites) is "more," up toward
the complete list.

> Absolute minimum, if a plugin refuses the per-type floor: a single leaf catch-all
> (`{type:string}` used for all scalars) + a single container catch-all. Complete, allowed,
> discouraged — every scalar then renders as the same control. The per-type floor is the
> required set; this is the escape hatch.
