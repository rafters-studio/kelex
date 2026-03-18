export type {
  FormTemplateInput,
  GenerateOptions,
  GenerateResult,
} from "./codegen";

export {
  generate,
  generateFieldJSX,
  generateFormFile,
  inferTypeName,
} from "./codegen";

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

export { extractConstraints, introspect, unwrapSchema } from "./introspection";

export type {
  ComponentConfig,
  ComponentType,
  MappingRule,
} from "./mapping";

export {
  defaultMappingRules,
  findMatchingRule,
  resolveField,
} from "./mapping";

export type {
  SchemaWriterOptions,
  SchemaWriterResult,
} from "./schema-writer";

export { emitField, writeSchema } from "./schema-writer";

export type {
  CodegenTarget,
  CompositeOptions,
  ReactTanStackOptions,
  TargetOptions,
  TargetOutputFile,
  TargetResult,
} from "./targets";

export {
  compositeTarget,
  listTargets,
  reactTanStackTarget,
  registerTarget,
  resolveTarget,
  unregisterTarget,
} from "./targets";
