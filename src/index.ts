// Codegen types
export type {
  FormTemplateInput,
  GenerateOptions,
  GenerateResult,
} from "./codegen";

// Codegen functions
export {
  generate,
  generateFieldJSX,
  generateFormFile,
  inferTypeName,
} from "./codegen";

// Introspection types
export type {
  FieldConstraints,
  FieldDescriptor,
  FieldMetadata,
  FieldType,
  FormDescriptor,
  FormStep,
  IntrospectOptions,
  UnwrapResult,
} from "./introspection";

// Introspection functions
export { extractConstraints, introspect, unwrapSchema } from "./introspection";

// Mapping types
export type {
  ComponentConfig,
  ComponentType,
  MappingRule,
} from "./mapping";

// Mapping functions
export {
  defaultMappingRules,
  findMatchingRule,
  resolveField,
} from "./mapping";

// Schema writer types
export type {
  SchemaWriterOptions,
  SchemaWriterResult,
} from "./schema-writer";

// Schema writer functions
export { emitField, writeSchema } from "./schema-writer";

// Target types
export type {
  CodegenTarget,
  CompositeOptions,
  ReactTanStackOptions,
  TargetOptions,
  TargetOutputFile,
  TargetResult,
} from "./targets";

// Target functions and built-in targets
export {
  compositeTarget,
  listTargets,
  reactTanStackTarget,
  registerTarget,
  resolveTarget,
} from "./targets";
