---
"@rafters/kelex": patch
---

Fix `z.readonly()` degrading a field's type. `z.number().readonly()` introspected as type `"string"` (with a warning), losing the inner number type and its constraints, for one transparent wrapper. `readonly` now joins the peeled wrapper set, so the inner type and constraints survive and `.meta()` on the inner schema is still found. `z.lazy()` and recursive schemas remain a documented limitation (warn-and-degrade).
