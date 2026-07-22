---
"@rafters/kelex": minor
---

Carry a discriminated-union discriminator with its real type. `buildUnionMetadata` did `String(value)`, so a boolean or numeric discriminator (`z.literal(true)`, `z.literal(1)`) became the string `"true"`/`"1"` -- and the writer re-emitted `z.literal("true")`, producing a schema that rejects the boolean/number the original accepted. `variants[].value` is now `string | number | boolean` sourced from the literal, and the writer re-emits `z.literal(true)`/`z.literal(1)`. String discriminators are unchanged.
