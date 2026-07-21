---
"@rafters/kelex": patch
---

Fix `z.int()` losing its int-ness. `z.int()` carries the constraint as a def-level number format (`"safeint"`), where `z.number().int()` carries it as a check — so the idiomatic Zod 4 spelling introspected as a plain number and hashed differently from the equivalent `z.number().int()`. Both now produce `isInt: true` and the same version; the sized-integer formats (`int32`, `uint32`) are covered too.
