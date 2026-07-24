---
"@rafters/kelex": minor
---

Add the plugin conformance harness (`conformance`). Runs the five contract
invariants -- floor, totality, path-preservation, determinism, and handler-join
-- over a shape battery plus seeded fuzzed schemas, so a plugin author (and
kelex's own defaults) can prove a renderer/handler honors the contract.
Path-preservation reads stamped names out of the actual rendered output via a
caller-supplied `names` reader (the output `T` is opaque to the engine);
handler-join validates crafted bad data with real Standard Schema and asserts
every issue binds. Fuzzing targets the schema space, never a plugin's components.
