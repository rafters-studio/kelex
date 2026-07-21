---
"@rafters/kelex": patch
---

Warn on unrecognized string formats. `z.iso.date()`, `z.ipv4()`, `z.jwt()`, `z.base64()` and other Zod 4 string formats carry a def-level `format` with no check, so they slipped past the checks loop and degraded to an unconstrained string with no warning (the writer then re-emitted `z.string()`). An unrecognized def-level string format now produces a path-qualified warning; the five represented formats (email, url, uuid, cuid, datetime) are unchanged.
