---
"@rafters/kelex": minor
---

**Structured warnings.** `FormDescriptor.warnings` and `GenerateResult.warnings` change from `string[]` to `Warning[]`, where a `Warning` is `{ path: PathSegment[]; code: WarningCode; message: string }`. Consumers switch on the stable `code` and locate by `path` (Standard Schema convention) rather than parsing prose.

This is a **breaking change**, chosen deliberately: the package is pre-1.0 with no external consumers, and leaving the prose `string[]` in place would let a consumer freeze the wording. `WarningCode` is a stable enum (`catch-fallback-dropped`, `transform-output-dropped`, `format-unrecognized`, `refine-unrepresented`, `unsupported-type`, ...). The `message` is unchanged prose for CLI display. `generate()` wraps a target's own prose warnings as `{ code: "target-warning", path: [] }` so the combined list is uniform. `Warning` and `WarningCode` are exported from the package root.
