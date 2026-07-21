---
"@rafters/kelex": patch
---

Warn when a `.transform()` or `.pipe()` output side is dropped. The reader peels a pipe to its input side (what a form collects), but the transformed output type and any output-side constraints were dropped with no warning — `z.string().transform(s => s.length)` introspected as a plain string, and its version hash matched a plain `z.string()`, so a consumer could not see a transform being added or removed. The input side is still read; a path-qualified warning now names the field whose output side is not represented.
