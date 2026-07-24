import type { FieldDescriptor } from "../introspection";

/** Supported Rafters/shadcn component types */
export type ComponentType =
  | "Input"
  | "Textarea"
  | "Select"
  | "Checkbox"
  | "RadioGroup"
  | "Slider"
  | "DatePicker"
  | "Fieldset"
  | "FieldArray"
  | "UnionSwitch";

/** Configuration for rendering a single field */
export interface ComponentConfig {
  /** Which component to render */
  component: ComponentType;

  /** Props to pass to the component */
  componentProps: Record<string, unknown>;

  /** Props for the Field wrapper */
  fieldProps: {
    label: string;
    description?: string;
    required: boolean;
  };
}

/** A rule that matches fields to components */
export interface MappingRule {
  /** Human-readable name for debugging */
  name: string;

  /** Returns true if this rule applies to the field */
  match: (field: FieldDescriptor) => boolean;

  /** Returns the component type for this field */
  component: ComponentType;

  /** Returns component-specific props */
  getProps: (field: FieldDescriptor) => Record<string, unknown>;
}
