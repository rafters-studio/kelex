---
"@rafters/kelex": minor
---

Validate a target's output at the `generate()` seam. `generate()` passed a target's result straight through, so a buggy (especially third-party) target could throw a raw error deep in the caller, return a `files: []` / malformed shape the compile-time `TargetResult` type could not catch, or silently drop a descriptor field. `generate()` -- the single seam every target passes through -- now wraps a target throw with the target name and form context, runtime-validates the result shape with a clear error naming the target, and appends a `target-field-unprocessed` warning (new `WarningCode`, emitted only here, never by `introspect()`) for each descriptor field the target did not report processing. The composite target passes cleanly.
