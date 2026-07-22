---
"@rafters/kelex": minor
---

Add a descriptor FORMAT version. `FormDescriptor` gains a top-level `formatVersion: number` (currently `1`) describing the shape of the descriptor itself, distinct from `version` (which hashes one schema's content). A `FORMAT_VERSION` constant is exported. It is excluded from the content hash (which covers `fields` only), so it does not churn `version`, and it is stamped top-level in the composite artifact. A consumer reading an unrecognized `formatVersion` should fail closed rather than guess at an unknown shape.
