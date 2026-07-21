---
"@rafters/kelex": patch
---

Minor robustness fixes from the foundation audit. A non-finite default (`Infinity`, `-Infinity`, `NaN`) is now refused and warned rather than emitted as `.default(null)` (silent corruption). Identical warnings are de-duplicated. A discriminated-union variant whose discriminator is not a literal warns rather than fabricating a `z.literal("unknown")`. The no-default vs `.default(undefined)` ambiguity, `Object.entries` integer-key field ordering, and the fact that introspection may invoke a refinement's error callback are now documented in code.
