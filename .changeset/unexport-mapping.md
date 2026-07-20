---
"@rafters/kelex": major
---

Remove the mapping module from the public API. `resolveField`, `findMatchingRule`, `defaultMappingRules` and the `ComponentConfig`, `ComponentType` and `MappingRule` types are no longer exported from the package root.

kelex does not own component selection. Which component renders a field belongs to the consumer, along with the rest of the presentation layer — kelex carries presentation data losslessly and makes no presentation decisions. Exporting a component-selection table contradicted that boundary in the one place a consumer would actually discover it.

The module remains in the tree, unmodified. It is unreachable from the pipeline — `generate()` calls `introspect()` and the target directly, and has never called `resolveField` — so nothing in kelex's behavior changes.

Consumers that were importing these should own the field-type-to-component table on their side, reading `FieldDescriptor.type`, `constraints` and `metadata` from the descriptor to make the choice.
