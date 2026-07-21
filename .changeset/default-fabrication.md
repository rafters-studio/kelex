---
"@rafters/kelex": patch
---

Fix two `.default()` defects in the reader.

A **function default is no longer baked in as a fabricated literal**. Zod 4 exposes `def.defaultValue` as a getter that invokes a function default on every access, so `z.number().default(() => Math.random())` was recording a per-call value. The value is now read twice and trusted only when the two reads are structurally equal: a static default, a constant function (`() => 42`), and a fresh-but-equal object (`() => []`) are recorded as before; a varying default (`Math.random`, `crypto.randomUUID`, a counter) records nothing and warns, so the descriptor and its version hash stay deterministic. This is the same never-fabricate rule already applied to `.catch()`.

Known residual: a coarse time default (`() => Date.now()`) whose two reads land in the same millisecond still reads as stable and is recorded — no worse than before, and it affects only that schema's version determinism.

**default-of-default now records the value Zod applies.** `z.string().default("inner").default("outer")` recorded `"inner"`; Zod applies `"outer"`. The outermost default now wins, and an unstable outer default no longer falls through to a shadowed inner one.
