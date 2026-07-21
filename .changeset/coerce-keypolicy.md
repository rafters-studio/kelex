---
"@rafters/kelex": patch
---

Warn on coercion and unknown-key policy. `z.coerce.number()` introspected as a plain number, and `z.strictObject()`/`.catchall()`/`.passthrough()` introspected identically to a plain `z.object()` — both dropped with no warning, silently changing what inputs a form accepts and widening a strict object to a permissive one on round-trip. Both now produce a path-qualified warning (a top-level strict object warns at `(form)`).
