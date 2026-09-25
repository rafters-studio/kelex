# kelex

Releases are tag-driven: kelex, `@kelex/plugin-renderer-html` and `@kelex/plugin-handler-post` share one version, and a `vX.Y.Z` tag publishes all three. The entries below Unreleased were published as `@rafters-studio/kelex`.

## Unreleased

### Breaking

- **kelex is a plugin host.** A `kelex.settings.jsonc` names a renderer and, optionally, a handler; `kelex form` and `generateForm` load them from your project and generate the form. The HTML renderer and the POST handler moved out of the core package into `@kelex/plugin-renderer-html` and `@kelex/plugin-handler-post`. The package is now `kelex`, with subpath entries (`kelex/engine`, `kelex/introspection`, `kelex/conformance`, `kelex/targets`, `kelex/schema-writer`) in place of one barrel.
- **The React target is gone.** The composite JSON descriptor is the only built-in codegen target.
- **Warnings are structured**: `{ path, code, message }`, with a stable `code` to switch on. Every code is documented in `docs/warnings.md`.
- **`generateForm` is generic over the output type** and returns the renderer's output unchanged; the CLI refuses output that is not a string.
- **`FormDescriptor.schemaImportPath` and `schemaExportName` are optional**, matching what `introspect` emits when called as a library. The schema-writer derives an export name from the form name when none is recorded, and refuses two schemas that would share an export or type name.
- **Descriptor format version 2** adds `ref` fields for recursive schemas, `literal` as a field type, `minDate`/`maxDate`, `patternFlags`, and typed discriminator values.

### Added

- The plugin engine: `render`, `renderForm`, `route`, `validateRenderer`, and the `Renderer`/`Handler` contract, plus a conformance harness for plugin authors.
- The default plugins: a classless HTML renderer whose inventory is data, and an async POST handler that validates natively in the browser and routes server issues to their fields.
- Recursive schemas, spelled with `z.lazy` or with getters, including through unions and intersections.
- Union variant labels from `.meta()`, and implicit discriminators promoted from plain unions of tagged objects.
- Warnings for coercion, unknown-key policies, transforms, unrecognized formats, refine messages, and every check on a field that falls back to a string (bigint bounds, the range of `z.int64()`/`z.uint64()`, file and set sizes, `z.custom()` predicates).
- Plugins load as ESM or CommonJS, resolve next to the settings file, and fail naming the package when missing, unloadable, or the wrong shape.

### Fixed

- `.catch()`, `.readonly()`, `z.int()`, object-form `z.enum()`, regex flags, date bounds, function defaults, and intersection fields no longer lose their type or constraints.
- The POST handler no longer writes through `Object.prototype` for keys like `constructor`, and element ids stay safe in attributes for any key.
- The core API no longer imports `node:crypto`, so it runs in browsers, workers and edge runtimes.

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
