---
"@rafters/kelex": minor
---

Carry union variant labels from member `.meta()`. A union variant now surfaces its member schema's `.meta()` payload as `variants[].meta` (verbatim, like `FieldDescriptor.meta`), so a consumer can label the variant chooser — `z.union([Card.meta({ title: "Card" }), Bank.meta({ title: "Bank" })])`. It is read off the member instance via the wrapper-chain-walking `collectMeta`, works for discriminated and plain unions, and is absent when the member has no meta. Because a variant label is presentation, not contract, it is excluded from the content `version` hash (a variant `meta`/`label` no longer churns the version).
