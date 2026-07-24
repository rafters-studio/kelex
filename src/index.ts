export type { GenerateOptions, GenerateResult } from "./codegen";

export { generate } from "./codegen";

export type {
  FieldConstraints,
  FieldDescriptor,
  FieldMetadata,
  FieldType,
  FormDescriptor,
  FormStep,
  IntrospectOptions,
  UnwrapResult,
  Warning,
  WarningCode,
} from "./introspection";

export { extractConstraints, FORMAT_VERSION, introspect, unwrapSchema } from "./introspection";

// The mapping module (resolveField, findMatchingRule, defaultMappingRules,
// ComponentConfig, ComponentType, MappingRule) is deliberately NOT exported.
// kelex does not own component selection -- which component renders a field is
// the consumer's decision, along with the rest of the presentation layer. The
// module remains in-tree but is not public API; see #155.

export type { SchemaWriterOptions, SchemaWriterResult } from "./schema-writer";

export { emitField, writeSchema } from "./schema-writer";

// The plugin engine's public contract (form-word types) and the `render` fold.
// The internal join (`controlPaths`) / match engine (`matches`, `resolveConfig`)
// are NOT exported -- the plugin API never surfaces a CS term.
export { render, renderForm, route, validateRenderer } from "./engine";
export type {
  Binding,
  Bound,
  Child,
  Composer,
  Config,
  Control,
  Entry,
  Handler,
  Input,
  Issue,
  Match,
  Renderer,
  Setting,
  Variant,
} from "./engine";

// The default base-HTML renderer (leaf half, #226): a zero-dependency, classless
// renderer shipped in-package. A true plugin -- imports only the public contract.
export { htmlRenderer, pathToId } from "./renderers/html";

// The conformance harness: prove a plugin honors the contract. A testing tool
// (it takes a `names` reader for the opaque `T`), not part of the runtime
// contract -- exported so plugin authors and kelex's own defaults can run it.
export { conformance } from "./conformance";
export type {
  ConformanceCoverage,
  ConformanceFailure,
  ConformanceOptions,
  ConformanceReport,
  Invariant,
} from "./conformance";

export type {
  CodegenTarget,
  CompositeOptions,
  TargetOptions,
  TargetOutputFile,
  TargetResult,
} from "./targets";

export {
  compositeTarget,
  listTargets,
  registerTarget,
  resolveTarget,
  unregisterTarget,
} from "./targets";
