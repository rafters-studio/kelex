---
"@rafters/kelex": patch
---

Fix `z.enum()` reporting the wrong values for the object form. `z.enum({ Red: "r", Blue: "b" })` reported `["Red", "Blue"]` (the keys), but the schema accepts the VALUES — `.parse("Red")` fails, `.parse("r")` succeeds. A plugin rendering a select from those values submitted data the schema rejected. The descriptor now carries the accepted values (`["r", "b"]`); the array form (`z.enum(["a","b"])`, keys == values) is unchanged.

Numeric enums are now carried too: their values are recorded (with reverse-mapping entries of a TS enum dropped), and the schema-writer re-emits them as a union of literals accepting the same set, with a warning that it is not a `z.enum()`. `FieldMetadata` for enums widened from `readonly string[]` to `readonly (string | number)[]`.
