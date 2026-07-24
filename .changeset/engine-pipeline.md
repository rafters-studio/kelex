---
"@rafters/kelex": minor
---

Add `renderForm(descriptor, renderer, handler?)` -- the engine pipeline (`wire . render`) -- and `validateRenderer` (the floor). The floor requires a TYPE-ONLY catch-all for every `FieldType` (a constrained entry does not prove the bare type is handled) and a composer for every named component; `renderForm` runs it and throws on gaps rather than dropping a field. Named to avoid colliding with the existing `generate()`/`CodegenTarget` target path, which is left untouched.
