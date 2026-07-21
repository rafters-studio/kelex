---
"@rafters/kelex": patch
---

Fix two defects in the descriptor content hash.

**A bigint no longer crashes `introspect()`.** `computeVersion` serialized fields with `JSON.stringify`, which throws on bigint, so any bigint literal or default (`z.literal(1n)`, `z.bigint().default(5n)`) killed the whole pipeline. Hashing now uses a bigint- and Date-aware stable serializer. The composite target, which had the same `JSON.stringify` landmine independently, renders a bigint as its decimal string rather than throwing.

**Presentation keys no longer collide inside value payloads.** The `label`/`description`/`meta`/`schemaRef` exclusion was applied at every object depth, including the CONTENTS of a `defaultValue` object, so three defaults `{label:"aaa",x:1}`, `{label:"bbb",x:1}`, `{x:1}` all hashed the same -- skew-detection blindness. The exclusion now applies only to an object recognized as a FieldDescriptor, never to a user value payload.

No version churns for existing schemas: the canonical fixture still hashes to `11617b63d9d43a33`, and a field-level `.meta()` label is still excluded.
