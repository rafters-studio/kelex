import type { FieldDescriptor } from "../introspection";
import { defaultMappingRules, findMatchingRule } from "./default-map";
import type { ComponentConfig, MappingRule } from "./types";

/**
 * Resolves a FieldDescriptor to a ComponentConfig using mapping rules.
 * For composite types, recursively resolves child fields and attaches
 * child configs via componentProps.
 *
 * @throws Error if no rule matches the field
 */
export function resolveField(
  field: FieldDescriptor,
  rules: MappingRule[] = defaultMappingRules,
): ComponentConfig {
  const matchedRule = findMatchingRule(field, rules);

  if (!matchedRule) {
    throw new Error(`No mapping rule matched field "${field.name}" of type "${field.type}"`);
  }

  const props = matchedRule.getProps(field);

  // For composite types, recursively resolve children
  if (field.type === "object" && field.metadata.kind === "object") {
    const childConfigs = new Map<string, ComponentConfig>();
    for (const child of field.metadata.fields) {
      childConfigs.set(child.name, resolveField(child, rules));
    }
    props.childConfigs = childConfigs;
    props.childFields = field.metadata.fields;
  }

  if (field.type === "array" && field.metadata.kind === "array") {
    const elementConfig = resolveField(field.metadata.element, rules);
    props.elementConfig = elementConfig;
    props.elementField = field.metadata.element;
  }

  if (field.type === "union" && field.metadata.kind === "union") {
    const variantConfigs: {
      value: string | number | boolean;
      fields: FieldDescriptor[];
      configs: Map<string, ComponentConfig>;
    }[] = [];
    for (const variant of field.metadata.variants) {
      const configs = new Map<string, ComponentConfig>();
      for (const vField of variant.fields) {
        configs.set(vField.name, resolveField(vField, rules));
      }
      variantConfigs.push({
        value: variant.value,
        fields: variant.fields,
        configs,
      });
    }
    props.discriminator = field.metadata.discriminator;
    props.variantConfigs = variantConfigs;
  }

  if (field.type === "tuple" && field.metadata.kind === "tuple") {
    const childConfigs = new Map<string, ComponentConfig>();
    for (const elem of field.metadata.elements) {
      childConfigs.set(elem.name, resolveField(elem, rules));
    }
    props.childConfigs = childConfigs;
    props.childFields = field.metadata.elements;
  }

  if (field.type === "record" && field.metadata.kind === "record") {
    const valueConfig = resolveField(field.metadata.valueDescriptor, rules);
    props.elementConfig = valueConfig;
    props.elementField = field.metadata.valueDescriptor;
  }

  return {
    component: matchedRule.component,
    componentProps: props,
    fieldProps: {
      label: field.label,
      description: field.description,
      required: !field.isOptional,
    },
  };
}
