# @ezmode-games/kelex

## 0.1.2

### Patch Changes

- Configure npm OIDC trusted publishing for automated releases

## 0.1.1

### Patch Changes

- 8e0ded6: Add deep assertions for all 11 stress test schemas

  - 3 new test blocks per schema (introspection fidelity, component mapping, JSX structure)
  - Full assertion tables covering field types, optionality, nullability, constraints, and nested paths
  - 55 total stress tests (up from 22), covering all composite types (Fieldset, FieldArray, UnionSwitch)

## 0.1.0

### Minor Changes

- 3c1828c: Initial release of kelex - generate React form components from Zod schemas.

  Features:

  - CLI tool for generating forms from Zod schema files
  - Support for string, number, boolean, date, and enum types
  - Automatic component selection based on field constraints
  - TanStack Form integration for state management
  - Rafters/shadcn UI component support
  - Full TypeScript type inference from schemas
  - Programmatic API for custom build pipelines
