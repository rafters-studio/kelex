# @rafters/kelex

## Unreleased

### Features

- **The form plugin engine.** `renderForm(descriptor, renderer, handler?)` folds a `FormDescriptor` through two independent adapters — a `Renderer<T>` (schema → output) and a `Handler<T>` (output → behavior) — that meet only at the descriptor's canonical path (`name = path`). Five form-word shapes (control/group/list/choice/recursive), a first-match inventory, and a completeness floor that rejects an incomplete renderer up front. Exports `render`, `renderForm`, `route`, `validateRenderer`, and the contract types.
- **Conformance harness.** `conformance(renderer, handler?, { names })` runs five contract invariants (floor, totality, path-preservation, determinism, handler-join) over a shape battery plus a seeded fuzzer, so a plugin can prove it honors the contract.
- **Default base-HTML renderer** (`htmlRenderer` / `createHtmlRenderer`). Zero-dependency, classless semantic HTML: constraints become native validation attributes, every control emits the accessibility hook trio and a path-addressed error slot. Ships an example stylesheet at `@rafters/kelex/form.css`.
- **Default async-POST handler** (`postHandler` / `createPostHandler`). Native HTML5 client validation, typed collection to nested JSON, `fetch` POST, and server `~standard` issues routed to error slots by path; owns union show/hide and array add/remove.
- **Introspection**: recursive schemas via a `ref` node, discriminated-union variant labels, and implicit-discriminator detection.

### Changed

- **Breaking:** removed the React/TanStack code target — kelex no longer owns component selection or framework wiring; that is the renderer/handler plugins' job.
- **Release:** tag-driven (push a `vX.Y.Z` tag) with npm provenance and GitHub-generated release notes; changesets removed in favor of this hand-maintained changelog.

### Fixed

- Introspection robustness across the stress suite: ISO date bounds, multi-value and typed literals, regex flags, enum values, structured warning paths, and synthetic union variants.

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
