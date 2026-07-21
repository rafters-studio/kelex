---
"@rafters/kelex": patch
---

An intersection used as a field value now flattens to a merged object, instead of degrading to a string. `z.object({ address: z.intersection(Base, Timestamped) })` previously introspected `address` as an unconstrained string with an "unsupported type" warning, dropping the merged shape and any `.refine()` on it — the same silent-drop class #153 closed, but for intersection fields rather than intersection roots.

Field-level intersections now merge exactly as root ones do: the combined shape, overlapping-key warnings, and member/nested refine warnings, all carrying the field's path (`Field "address"`, `Field "outer.inner"`) rather than reading as form-level. Non-object members still error, and the merged field round-trips through the schema writer.

Root-intersection behavior is unchanged — the path threading defaults to empty at the root.
