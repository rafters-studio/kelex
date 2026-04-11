import type { FieldDescriptor } from "../../introspection";
import type { ComponentConfig } from "../../mapping";

/**
 * Escapes a string for use in a JSX attribute value (double-quoted).
 */
function escapeJSXAttribute(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n");
}

/**
 * Escapes a string for use as JSX text content.
 */
function escapeJSXText(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\{/g, "&#123;")
    .replace(/\}/g, "&#125;");
}

/**
 * Generates the JSX string for a field within form.Field render prop.
 * For composite types, recursively generates child fields.
 *
 * @param fieldPath - dot-separated path for nested fields (e.g. "address.street")
 */
export function generateFieldJSX(
  field: FieldDescriptor,
  config: ComponentConfig,
  fieldPath?: string,
): string {
  const { component, componentProps, fieldProps } = config;
  const path = fieldPath ?? field.name;

  // Composite types get special handling
  if (component === "Fieldset") {
    return buildFieldsetJSX(field, config, path);
  }
  if (component === "FieldArray") {
    return buildFieldArrayJSX(field, config, path);
  }
  if (component === "UnionSwitch") {
    return buildUnionSwitchJSX(field, config, path);
  }

  const fieldPropsStr = buildFieldProps(fieldProps);
  const componentJSX = buildComponentJSX(field.name, component, componentProps);

  return `<form.Field
  name="${escapeJSXAttribute(path)}"
  children={(field) => (
    <Field
${fieldPropsStr}
      error={field.state.meta.errors?.[0]}
    >
${componentJSX}
    </Field>
  )}
/>`;
}

function buildFieldsetJSX(
  field: FieldDescriptor,
  config: ComponentConfig,
  path: string,
): string {
  const { componentProps, fieldProps } = config;
  const childConfigs = componentProps.childConfigs as
    | Map<string, ComponentConfig>
    | undefined;
  const childFields = componentProps.childFields as
    | FieldDescriptor[]
    | undefined;

  if (!childConfigs || !childFields) {
    return `{/* ${field.name}: no child configs */}`;
  }

  const childJSXs: string[] = [];
  for (const child of childFields) {
    const childConfig = childConfigs.get(child.name);
    if (childConfig) {
      const childPath = `${path}.${child.name}`;
      const jsx = generateFieldJSX(child, childConfig, childPath);
      childJSXs.push(indent(jsx, 2));
    }
  }

  return `<Card>
  <CardHeader>
    <CardTitle>${escapeJSXText(fieldProps.label)}</CardTitle>
  </CardHeader>
  <CardContent className="flex flex-col gap-3">
${childJSXs.join("\n\n")}
  </CardContent>
</Card>`;
}

function buildFieldArrayJSX(
  field: FieldDescriptor,
  config: ComponentConfig,
  path: string,
): string {
  const { componentProps, fieldProps } = config;
  const elementConfig = componentProps.elementConfig as
    | ComponentConfig
    | undefined;
  const elementField = componentProps.elementField as
    | FieldDescriptor
    | undefined;

  if (!elementConfig || !elementField) {
    return `{/* ${field.name}: no element config */}`;
  }

  // For record types, render a key-value pair structure
  if (field.type === "record") {
    return buildRecordJSX(field, elementConfig, elementField, path, fieldProps);
  }

  // For array of objects, render nested cards
  if (
    elementField.type === "object" &&
    elementField.metadata.kind === "object"
  ) {
    return buildArrayOfObjectsJSX(
      field,
      elementConfig,
      elementField,
      path,
      fieldProps,
    );
  }

  // For array of unions (e.g., array of discriminated unions)
  if (elementField.type === "union") {
    return buildArrayOfUnionsJSX(
      field,
      elementConfig,
      elementField,
      path,
      fieldProps,
    );
  }

  // For simple arrays (strings, numbers, etc.)
  return buildSimpleArrayJSX(field, elementConfig, path, fieldProps);
}

function buildSimpleArrayJSX(
  _field: FieldDescriptor,
  elementConfig: ComponentConfig,
  path: string,
  fieldProps: ComponentConfig["fieldProps"],
): string {
  const isNumberElement = elementConfig.componentProps.type === "number";
  const onChange = isNumberElement
    ? "onChange={(e) => field.handleChange(e.target.valueAsNumber)}"
    : "onChange={(e) => field.handleChange(e.target.value)}";
  const pushValue = isNumberElement ? "0" : '""';
  return `<form.Field name="${escapeJSXAttribute(path)}" mode="array">
  {(arrayField) => (
    <Card>
      <CardHeader>
        <CardTitle>${escapeJSXText(fieldProps.label)}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {(arrayField.state.value ?? []).map((_, i) => (
          <div key={i} className="flex items-center gap-2">
            <form.Field
              name={\`${escapeJSXAttribute(path)}[\${i}]\`}
              children={(field) => (
                <Field label={\`Item \${i + 1}\`} error={field.state.meta.errors?.[0]}>
                  <Input
                    value={field.state.value ?? ""}
                    ${onChange}
                    onBlur={field.handleBlur}
                  />
                </Field>
              )}
            />
            <Button type="button" variant="outline" size="sm" onClick={() => arrayField.removeValue(i)}>Remove</Button>
          </div>
        ))}
        <Button type="button" variant="outline" onClick={() => arrayField.pushValue(${pushValue})}>Add ${escapeJSXText(fieldProps.label)}</Button>
      </CardContent>
    </Card>
  )}
</form.Field>`;
}

function buildArrayOfObjectsJSX(
  _field: FieldDescriptor,
  elementConfig: ComponentConfig,
  elementField: FieldDescriptor,
  path: string,
  fieldProps: ComponentConfig["fieldProps"],
): string {
  const childConfigs = elementConfig.componentProps.childConfigs as
    | Map<string, ComponentConfig>
    | undefined;
  const childFields = elementConfig.componentProps.childFields as
    | FieldDescriptor[]
    | undefined;

  if (!childConfigs || !childFields) {
    return `{/* ${path}: no child configs for array element */}`;
  }

  const childJSXs: string[] = [];
  for (const child of childFields) {
    const childConfig = childConfigs.get(child.name);
    if (childConfig) {
      const childPath = `${path}[\${i}].${child.name}`;
      const jsx = generateFieldJSXTemplate(child, childConfig, childPath);
      childJSXs.push(indent(jsx, 6));
    }
  }

  return `<form.Field name="${escapeJSXAttribute(path)}" mode="array">
  {(arrayField) => (
    <Card>
      <CardHeader>
        <CardTitle>${escapeJSXText(fieldProps.label)}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {(arrayField.state.value ?? []).map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>${escapeJSXText(elementField.label)} {i + 1}</CardTitle>
              <Button type="button" variant="outline" size="sm" onClick={() => arrayField.removeValue(i)}>Remove</Button>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
${childJSXs.join("\n\n")}
            </CardContent>
          </Card>
        ))}
        <Button type="button" variant="outline" onClick={() => arrayField.pushValue({})}>Add ${escapeJSXText(elementField.label)}</Button>
      </CardContent>
    </Card>
  )}
</form.Field>`;
}

function buildArrayOfUnionsJSX(
  _field: FieldDescriptor,
  elementConfig: ComponentConfig,
  _elementField: FieldDescriptor,
  path: string,
  fieldProps: ComponentConfig["fieldProps"],
): string {
  const variantConfigs = elementConfig.componentProps.variantConfigs as
    | {
        value: string;
        fields: FieldDescriptor[];
        configs: Map<string, ComponentConfig>;
      }[]
    | undefined;
  const discriminator = elementConfig.componentProps.discriminator as
    | string
    | undefined;

  if (!variantConfigs || !discriminator) {
    return `{/* ${path}: no variant configs for array of unions */}`;
  }

  const variantBlocks: string[] = [];
  for (const variant of variantConfigs) {
    const fieldJSXs: string[] = [];
    for (const vField of variant.fields) {
      if (vField.name === discriminator) continue;
      const vConfig = variant.configs.get(vField.name);
      if (vConfig) {
        const vPath = `${path}[\${i}].${vField.name}`;
        const jsx = generateFieldJSXTemplate(vField, vConfig, vPath);
        fieldJSXs.push(indent(jsx, 10));
      }
    }

    variantBlocks.push(
      `          {item.${discriminator} === "${escapeJSXAttribute(variant.value)}" && (
            <div className="flex flex-col gap-3">
${fieldJSXs.join("\n\n")}
            </div>
          )}`,
    );
  }

  const optionValues = variantConfigs.map((v) => v.value);
  const optionItems = optionValues
    .map(
      (v) =>
        `                <Select.Item value="${escapeJSXAttribute(v)}">${escapeJSXText(formatOptionLabel(v))}</Select.Item>`,
    )
    .join("\n");

  return `<form.Field name="${escapeJSXAttribute(path)}" mode="array">
  {(arrayField) => (
    <Card>
      <CardHeader>
        <CardTitle>${escapeJSXText(fieldProps.label)}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {(arrayField.state.value ?? []).map((item, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Item {i + 1}</CardTitle>
              <Button type="button" variant="outline" size="sm" onClick={() => arrayField.removeValue(i)}>Remove</Button>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <form.Field
                name={\`${escapeJSXAttribute(path)}[\${i}].${discriminator}\`}
                children={(field) => (
                  <Field label="${escapeJSXAttribute(nameToLabel(discriminator))}" required>
                    <Select value={field.state.value} onValueChange={field.handleChange}>
                      <Select.Trigger>
                        <Select.Value placeholder="Select..." />
                      </Select.Trigger>
                      <Select.Content>
${optionItems}
                      </Select.Content>
                    </Select>
                  </Field>
                )}
              />
${variantBlocks.join("\n\n")}
            </CardContent>
          </Card>
        ))}
        <Button type="button" variant="outline" onClick={() => arrayField.pushValue({})}>Add Item</Button>
      </CardContent>
    </Card>
  )}
</form.Field>`;
}

function buildRecordJSX(
  _field: FieldDescriptor,
  _elementConfig: ComponentConfig,
  _elementField: FieldDescriptor,
  path: string,
  fieldProps: ComponentConfig["fieldProps"],
): string {
  return `<form.Field name="${escapeJSXAttribute(path)}">
  {(recordField) => (
    <Card>
      <CardHeader>
        <CardTitle>${escapeJSXText(fieldProps.label)}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {Object.entries(recordField.state.value ?? {}).map(([key]) => (
          <div key={key} className="flex items-center gap-2">
            <span className="text-sm min-w-24">{key}</span>
            <form.Field
              name={\`${escapeJSXAttribute(path)}.\${key}\`}
              children={(field) => (
                <Input
                  value={field.state.value ?? ""}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                />
              )}
            />
          </div>
        ))}
      </CardContent>
    </Card>
  )}
</form.Field>`;
}

function buildUnionSwitchJSX(
  field: FieldDescriptor,
  config: ComponentConfig,
  path: string,
): string {
  const { componentProps, fieldProps } = config;
  const discriminator = componentProps.discriminator as string | undefined;
  const variantConfigs = componentProps.variantConfigs as
    | {
        value: string;
        fields: FieldDescriptor[];
        configs: Map<string, ComponentConfig>;
      }[]
    | undefined;

  if (!discriminator || !variantConfigs) {
    return `{/* ${field.name}: no union config */}`;
  }

  const optionValues = variantConfigs.map((v) => v.value);
  const optionItems = optionValues
    .map(
      (v) =>
        `            <Select.Item value="${escapeJSXAttribute(v)}">${escapeJSXText(formatOptionLabel(v))}</Select.Item>`,
    )
    .join("\n");

  const variantBlocks: string[] = [];
  for (const variant of variantConfigs) {
    const fieldJSXs: string[] = [];
    for (const vField of variant.fields) {
      // Skip the discriminator field itself
      if (vField.name === discriminator) continue;
      const vConfig = variant.configs.get(vField.name);
      if (vConfig) {
        const vPath = `${path}.${vField.name}`;
        const jsx = generateFieldJSX(vField, vConfig, vPath);
        fieldJSXs.push(indent(jsx, 4));
      }
    }

    variantBlocks.push(
      `    <form.Subscribe selector={(state) => state.values.${path}.${discriminator}}>
      {(${discriminator}Value) => ${discriminator}Value === "${escapeJSXAttribute(variant.value)}" && (
        <div className="flex flex-col gap-3">
${fieldJSXs.join("\n\n")}
        </div>
      )}
    </form.Subscribe>`,
    );
  }

  return `<Card>
  <CardHeader>
    <CardTitle>${escapeJSXText(fieldProps.label)}</CardTitle>
  </CardHeader>
  <CardContent className="flex flex-col gap-3">
    <form.Field
      name="${escapeJSXAttribute(`${path}.${discriminator}`)}"
      children={(field) => (
        <Field label="${escapeJSXAttribute(nameToLabel(discriminator))}" required>
          <Select value={field.state.value} onValueChange={field.handleChange}>
            <Select.Trigger>
              <Select.Value placeholder="Select..." />
            </Select.Trigger>
            <Select.Content>
${optionItems}
            </Select.Content>
          </Select>
        </Field>
      )}
    />
${variantBlocks.join("\n\n")}
  </CardContent>
</Card>`;
}

/**
 * Like generateFieldJSX but uses template literal paths (for use inside .map()).
 * The path contains `${i}` template expressions that will be rendered inside backticks.
 */
function generateFieldJSXTemplate(
  field: FieldDescriptor,
  config: ComponentConfig,
  templatePath: string,
): string {
  const { component, componentProps, fieldProps } = config;

  // Composite types nested inside arrays
  if (component === "Fieldset") {
    return buildFieldsetJSXTemplate(field, config, templatePath);
  }
  if (component === "UnionSwitch") {
    // For union inside array, simplified rendering
    return `{/* Union inside array: ${field.name} */}`;
  }

  const fieldPropsStr = buildFieldProps(fieldProps);
  const componentJSX = buildComponentJSX(field.name, component, componentProps);

  return `<form.Field
  name={\`${templatePath}\`}
  children={(field) => (
    <Field
${fieldPropsStr}
      error={field.state.meta.errors?.[0]}
    >
${componentJSX}
    </Field>
  )}
/>`;
}

function buildFieldsetJSXTemplate(
  field: FieldDescriptor,
  config: ComponentConfig,
  templatePath: string,
): string {
  const { componentProps, fieldProps } = config;
  const childConfigs = componentProps.childConfigs as
    | Map<string, ComponentConfig>
    | undefined;
  const childFields = componentProps.childFields as
    | FieldDescriptor[]
    | undefined;

  if (!childConfigs || !childFields) {
    return `{/* ${field.name}: no child configs */}`;
  }

  const childJSXs: string[] = [];
  for (const child of childFields) {
    const childConfig = childConfigs.get(child.name);
    if (childConfig) {
      const childPath = `${templatePath}.${child.name}`;
      const jsx = generateFieldJSXTemplate(child, childConfig, childPath);
      childJSXs.push(indent(jsx, 2));
    }
  }

  return `<Card>
  <CardHeader>
    <CardTitle>${escapeJSXText(fieldProps.label)}</CardTitle>
  </CardHeader>
  <CardContent className="flex flex-col gap-3">
${childJSXs.join("\n\n")}
  </CardContent>
</Card>`;
}

function buildFieldProps(fieldProps: ComponentConfig["fieldProps"]): string {
  const lines: string[] = [];

  lines.push(`      label="${escapeJSXAttribute(fieldProps.label)}"`);

  if (fieldProps.description) {
    lines.push(
      `      description="${escapeJSXAttribute(fieldProps.description)}"`,
    );
  }

  if (fieldProps.required) {
    lines.push("      required");
  }

  return lines.join("\n");
}

function buildComponentJSX(
  fieldName: string,
  component: ComponentConfig["component"],
  props: Record<string, unknown>,
): string {
  switch (component) {
    case "Input":
      return buildInputJSX(props);
    case "Textarea":
      return buildTextareaJSX(props);
    case "Checkbox":
      return buildCheckboxJSX();
    case "Select":
      return buildSelectJSX(props);
    case "RadioGroup":
      return buildRadioGroupJSX(fieldName, props);
    case "Slider":
      return buildSliderJSX(props);
    case "DatePicker":
      return buildDatePickerJSX();
    default:
      return `      {/* Unsupported component: ${component} */}`;
  }
}

function buildInputJSX(props: Record<string, unknown>): string {
  const propsStr = buildPropsString(props, [
    "type",
    "min",
    "max",
    "step",
    "minLength",
    "maxLength",
    "pattern",
  ]);
  const isNumber = props.type === "number";
  const onChange = isNumber
    ? "onChange={(e) => field.handleChange(e.target.valueAsNumber)}"
    : "onChange={(e) => field.handleChange(e.target.value)}";
  return `      <Input
${propsStr}
        value={field.state.value ?? ""}
        ${onChange}
        onBlur={field.handleBlur}
      />`;
}

function buildTextareaJSX(props: Record<string, unknown>): string {
  const propsStr = buildPropsString(props, ["maxLength"]);
  return `      <Textarea
${propsStr}
        value={field.state.value ?? ""}
        onChange={(e) => field.handleChange(e.target.value)}
        onBlur={field.handleBlur}
      />`;
}

function buildCheckboxJSX(): string {
  return `      <Checkbox
        checked={field.state.value ?? false}
        onCheckedChange={(checked) => field.handleChange(checked)}
      />`;
}

function buildSelectJSX(props: Record<string, unknown>): string {
  const options = props.options;
  if (!Array.isArray(options) || options.length === 0) {
    throw new Error("Select component requires a non-empty options array");
  }
  const optionItems = (options as string[])
    .map(
      (opt) =>
        `          <Select.Item value="${escapeJSXAttribute(opt)}">${escapeJSXText(formatOptionLabel(opt))}</Select.Item>`,
    )
    .join("\n");

  return `      <Select value={field.state.value} onValueChange={field.handleChange}>
        <Select.Trigger>
          <Select.Value placeholder="Select..." />
        </Select.Trigger>
        <Select.Content>
${optionItems}
        </Select.Content>
      </Select>`;
}

function buildRadioGroupJSX(
  fieldName: string,
  props: Record<string, unknown>,
): string {
  const options = props.options;
  if (!Array.isArray(options) || options.length === 0) {
    throw new Error("RadioGroup component requires a non-empty options array");
  }
  const radioItems = (options as string[])
    .map((opt) => {
      const id = `${fieldName}-${opt}`;
      return `        <div className="flex items-center gap-2">
          <RadioGroup.Item value="${escapeJSXAttribute(opt)}" id="${escapeJSXAttribute(id)}" />
          <Label htmlFor="${escapeJSXAttribute(id)}">${escapeJSXText(formatOptionLabel(opt))}</Label>
        </div>`;
    })
    .join("\n");

  return `      <RadioGroup value={field.state.value} onValueChange={field.handleChange}>
${radioItems}
      </RadioGroup>`;
}

function buildSliderJSX(props: Record<string, unknown>): string {
  const min = props.min ?? 0;
  const max = props.max ?? 100;
  const step = props.step ?? 1;

  return `      <Slider
        value={[field.state.value ?? ${min}]}
        onValueChange={([v]) => field.handleChange(v)}
        min={${min}}
        max={${max}}
        step={${step}}
      />`;
}

function buildDatePickerJSX(): string {
  return `      <DatePicker
        value={field.state.value}
        onValueChange={field.handleChange}
      />`;
}

function buildPropsString(
  props: Record<string, unknown>,
  keys: string[],
): string {
  const lines: string[] = [];

  for (const key of keys) {
    const value = props[key];
    if (value !== undefined) {
      if (typeof value === "string") {
        lines.push(`        ${key}="${escapeJSXAttribute(value)}"`);
      } else {
        lines.push(`        ${key}={${JSON.stringify(value)}}`);
      }
    }
  }

  return lines.join("\n");
}

function formatOptionLabel(value: string): string {
  return value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .replace(/^./, (s) => s.toUpperCase());
}

function nameToLabel(name: string): string {
  return name
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .replace(/^./, (s) => s.toUpperCase())
    .trim();
}

function indent(str: string, spaces: number): string {
  const pad = " ".repeat(spaces);
  return str
    .split("\n")
    .map((line) => (line.trim() ? `${pad}${line}` : line))
    .join("\n");
}
