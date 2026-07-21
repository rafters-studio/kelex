---
"@rafters/kelex": patch
---

Preserve regex flags. `FieldConstraints.pattern` carried only `RegExp.source`, so `z.string().regex(/abc/i)` round-tripped to `/abc/` — silently flipping case-sensitivity and narrowing the schema. A `patternFlags` slot now carries the flags, the writer re-emits `/abc/i`, and because flags change what validates they participate in the version hash.
