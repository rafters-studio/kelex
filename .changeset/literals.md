---
"@rafters/kelex": minor
---

Represent literals faithfully. `z.literal("x")` had `type: "string"` with `metadata.kind: "literal"` -- an in-band contradiction the schema-writer resolved by emitting `z.string()`, dropping the literal entirely; a multi-value `z.literal(["a","b"])` kept only the first value. Literals now have a first-class `type: "literal"` whose metadata carries all `values`, and the writer re-emits `z.literal(...)`.

**Version note:** a literal field's representation changed, so any schema containing a literal -- including a discriminated union's discriminator fields -- gets a new content `version`. The canonical fixture is re-pinned accordingly. `FieldType` gains `"literal"` and the literal `FieldMetadata` changes from `{ value }` to `{ values }`.
