---
"@rafters/kelex": minor
---

Promote an implicit discriminator in a plain union of tagged objects. A `z.union([...])` whose members are all objects sharing one literal field with distinct values is semantically discriminated, but only `z.discriminatedUnion` set a `discriminator` before — a plain union got `variant_N` placeholders and no selector. `buildUnionMetadata` now detects that shared literal field and promotes it (typed variant values, per #187), producing a descriptor identical to the equivalent `z.discriminatedUnion`. Zero candidates leaves the union unchanged; more than one warns (`discriminator-ambiguous`) and promotes nothing rather than guess.
