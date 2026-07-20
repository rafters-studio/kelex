---
"@rafters/kelex": patch
---

Fix `.catch()` degrading every field to an unconstrained string. `z.number().min(5).catch(0)` introspected as `type: "string"` with no constraints, and an enum lost its values entirely — so a renderer would emit a text input for a number field. The catch wrapper is now peeled and the inner type and constraints survive.

The fallback value itself is still not carried, and warns instead. Zod stores `.catch(0)` as a callback rather than a literal, so recovering it would mean invoking user code during introspection — and a context-dependent callback returns a plausible, type-valid, fabricated value that nothing downstream could distinguish from a real one.

**Descriptor version note:** this changes what a caught field introspects to, so `FormDescriptor.version` rerolls for any schema using `.catch()`. The content hash is stable for a given kelex version and a given schema; an introspection fix that changes what the reader sees will move it. Consumers pinning against the version should expect it to change on a kelex upgrade, not only on a schema edit.
