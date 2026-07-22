---
"@rafters/kelex": minor
---

Represent recursive schemas with a `ref` node instead of dropping them. A `z.lazy`/self-referential schema (a category tree, a comment thread) previously resolved to an `unsupported-type` warning and an unrepresented leaf. Introspection now unwraps `z.lazy` with cycle detection (by schema instance): a non-recursive lazy is transparent, and a self-reference emits a `{ kind: "ref"; target }` node at the cycle's closing edge, pointing at the ancestor it refers back to, so a consumer can render a recursive widget. Adds the `"ref"` `FieldType`/metadata kind and bumps `FORMAT_VERSION` to `2`. The schema-writer emits `z.unknown()` (with a warning) for a `ref`, since a recursive schema cannot be reconstructed from the flat descriptor.
