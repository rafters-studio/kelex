# Stress Test Deep Assertions Design

## Problem

The existing stress tests (`test/stress/stress.spec.ts`) cover 11 complex real-world Zod schemas but only verify shallow properties:

- "should generate a form" -- asserts `fields.length > 0`
- "should round-trip through schema writer" -- asserts field count and types match

Nothing verifies the **generated JSX structure**, **component mapping correctness**, **constraint propagation**, **nested field paths**, **import completeness**, or **warning expectations**.

## Solution

Extend the existing data-driven stress test with assertion tables per schema that verify both **pipeline fidelity** (introspection + mapping) and **generated code correctness** (JSX structure, paths, imports).

## Data Model

```ts
interface FieldAssertion {
  name: string;
  type: FieldType;
  isOptional?: boolean;   // default false
  isNullable?: boolean;   // default false
  component: ComponentType;
  constraints?: Partial<FieldConstraints>;

  // For composite types: dot-paths or template paths that must appear in generated code
  // Static paths: "address.street", "address.city"
  // Template paths (inside .map()): "items[${i}].name"
  nestedPaths?: string[];
}

interface SchemaTestCase {
  name: string;
  schema: unknown;
  expectedHardFeatures: string[];

  // Pipeline fidelity
  expectedFields: FieldAssertion[];

  // Generated JSX correctness
  expectedCodeContains: string[];
  expectedCodeExcludes?: string[];

  // Import correctness
  expectedImports: ComponentType[];

  // Warning expectations (default 0)
  expectedWarningCount?: number;
}
```

## Test Harness

Three new `it()` blocks per schema, added to the existing `for (const testCase of schemas)` loop:

### 1. Introspection fidelity

```ts
it("should introspect all expected fields with correct types", () => {
  const descriptor = introspect(testCase.schema, INTROSPECT_OPTS);

  expect(descriptor.fields).toHaveLength(testCase.expectedFields.length);

  for (const expected of testCase.expectedFields) {
    const actual = descriptor.fields.find((f) => f.name === expected.name);
    expect(actual, `missing field: ${expected.name}`).toBeDefined();
    expect(actual!.type).toBe(expected.type);

    if (expected.isOptional !== undefined) {
      expect(actual!.isOptional).toBe(expected.isOptional);
    }
    if (expected.isNullable !== undefined) {
      expect(actual!.isNullable).toBe(expected.isNullable);
    }
    if (expected.constraints) {
      for (const [key, value] of Object.entries(expected.constraints)) {
        expect(actual!.constraints[key as keyof FieldConstraints]).toBe(value);
      }
    }
  }
});
```

### 2. Component mapping correctness

```ts
it("should map fields to correct components", () => {
  const descriptor = introspect(testCase.schema, INTROSPECT_OPTS);

  for (const expected of testCase.expectedFields) {
    const field = descriptor.fields.find((f) => f.name === expected.name);
    if (!field) continue;

    const config = resolveField(field);
    expect(config.component, `${expected.name} component`).toBe(expected.component);
  }
});
```

### 3. Generated JSX correctness

```ts
it("should generate correct JSX structure", () => {
  const result = generate({
    schema: testCase.schema,
    formName: `${testCase.name.replace(/[^a-zA-Z]/g, "")}Form`,
    schemaImportPath: "./schema",
    schemaExportName: "schema",
  });

  // Code contains assertions
  for (const expected of testCase.expectedCodeContains) {
    expect(result.code, `code should contain: ${expected}`).toContain(expected);
  }

  // Code excludes assertions
  for (const excluded of testCase.expectedCodeExcludes ?? []) {
    expect(result.code, `code should not contain: ${excluded}`).not.toContain(excluded);
  }

  // Nested path assertions
  for (const field of testCase.expectedFields) {
    for (const path of field.nestedPaths ?? []) {
      // Paths appear either as name="path" (static) or name={`path`} (template)
      const staticMatch = result.code.includes(`"${path}"`);
      const templateMatch = result.code.includes(path);
      expect(staticMatch || templateMatch, `missing nested path: ${path}`).toBe(true);
    }
  }

  // Import assertions
  for (const component of testCase.expectedImports) {
    expect(result.code, `missing import: ${component}`).toContain(`${component},`);
  }

  // Warning count
  const expectedWarnings = testCase.expectedWarningCount ?? 0;
  expect(result.warnings).toHaveLength(expectedWarnings);
});
```

## Per-Schema Assertion Tables

### 01 Healthcare: Patient Intake

| Field | Type | Component | Key Constraints | Nested Paths |
|-------|------|-----------|-----------------|--------------|
| firstName | string | Input | minLength:1, maxLength:50 | |
| lastName | string | Input | minLength:1, maxLength:50 | |
| dateOfBirth | date | DatePicker | | |
| gender | enum | RadioGroup | | |
| email | string | Input | format:email | |
| phone | string | Input | | |
| address | object | Fieldset | | address.street, address.city, address.state, address.zip |
| insuranceProvider | string | Input | | |
| policyNumber | string | Input | | |
| emergencyContactName | string | Input | | |
| emergencyContactPhone | string | Input | | |
| currentMedications | string | Textarea | | |
| allergies | string | Textarea | | |
| reasonForVisit | string | Textarea | | |
| consentToTreatment | boolean | Checkbox | | |

Code contains: `<Fieldset`, `CardTitle`, `<Textarea`, `<DatePicker`, `<Checkbox`
Imports: Input, Textarea, RadioGroup, DatePicker, Checkbox

### 02 E-commerce: Product Listing

| Field | Type | Component | Key Constraints | Nested Paths |
|-------|------|-----------|-----------------|--------------|
| title | string | Input | minLength:1, maxLength:200 | |
| description | string | Textarea | minLength:10, maxLength:5000 | |
| sku | string | Input | pattern | |
| price | object | Fieldset | | price.amount, price.currency |
| category | enum | Select | | |
| tags | array | FieldArray | | |
| images | array | FieldArray | | |
| attributes | union | UnionSwitch | | attributes.type |
| isActive | boolean | Checkbox | | |

Code contains: `<Textarea`, `<Select`, `mode="array"`, `Select.Item value="physical"`, `Select.Item value="digital"`
Imports: Input, Textarea, Select, Checkbox

### 03 Finance: Loan Application

| Field | Type | Component | Notable | Nested Paths |
|-------|------|-----------|---------|--------------|
| loanDetails | union | UnionSwitch | discriminated union | loanDetails.loanType |

Code contains: `Select.Item value=`

### 04 HR: Job Application

| Field | Type | Component | Notable | Nested Paths |
|-------|------|-----------|---------|--------------|
| education | array | FieldArray | array of objects | education template paths |
| workExperience | array | FieldArray | array of objects | workExperience template paths |
| skills | array | FieldArray | simple array | |
| linkedinUrl | string | Input | nullable + optional | |
| coverLetter | string | Textarea | maxLength:5000 | |

Code contains: `mode="array"` (3 arrays), `<Textarea`

### 05 Real Estate: Property Listing

Tests intersection (`.and()`). All fields from the three intersected schemas should be flattened into the top-level form.

### 06 Education: Course Enrollment

| Field | Type | Component | Notable | Nested Paths |
|-------|------|-----------|---------|--------------|
| semester | tuple | Input | tuple renders as generic input | |
| courses | array | FieldArray | array of objects | course template paths |
| preferences | record | FieldArray | record type | |

### 07 Logistics: Shipment Booking

| Field | Type | Component | Notable | Nested Paths |
|-------|------|-----------|---------|--------------|
| shippingMethod | union | UnionSwitch | discriminated | shippingMethod paths |
| packages | array | FieldArray | array of objects | package template paths |
| origin/destination | object | Fieldset | nested objects | address sub-paths |

### 08 Legal: Contract Intake

Tests branded type (should pass through as string), nullish fields.

### 09 SaaS: User Settings

| Field | Type | Component | Notable | Nested Paths |
|-------|------|-----------|---------|--------------|
| notifications | object | Fieldset | nested booleans | notifications.email, notifications.sms |
| featureFlags | record | FieldArray | record type | |

### 10 Insurance: Claims Submission

| Field | Type | Component | Notable | Nested Paths |
|-------|------|-----------|---------|--------------|
| claimant | object | Fieldset | deeply nested (claimant.address) | claimant.firstName, claimant.address.street |
| claimDetails | union | UnionSwitch | discriminated | claimDetails paths |
| documents | array | FieldArray | array of objects | document template paths |

### 11 Government: Tax Filing

| Field | Type | Component | Notable | Nested Paths |
|-------|------|-----------|---------|--------------|
| address | object | Fieldset | nested | address.street, address.city |
| dependents | array | FieldArray | optional array of objects | |
| incomeSources | array | FieldArray | array of discriminated unions | |
| itemizedDeductions | object | Fieldset | optional nested object | |
| bankAccountForRefund | object | Fieldset | optional nested object | |

Code contains: `mode="array"` (2 arrays), `CardTitle`
This is the most complex schema -- tests array of discriminated unions, cross-field `.check()`, conditional required fields.

## Implementation Notes

- The assertion tables will be filled in completely during implementation by running introspect + resolveField on each schema and capturing the actual output
- Schemas that use `.and()` (intersection) need special handling -- verify the flattened field list
- The `.check()` refinements on schemas 03 and 11 are runtime-only and don't affect introspection, so no special assertions needed
- Branded types (schema 08) should pass through as their base type

## Files to Change

1. `test/stress/stress.spec.ts` -- expand SchemaTestCase interface, add assertion tables, add 3 new test blocks
2. No new files needed

## Success Criteria

- All 11 schemas pass all 5 test blocks (2 existing + 3 new)
- Every composite field (Fieldset, FieldArray, UnionSwitch) has at least one nested path assertion
- Every schema has at least 3 `expectedCodeContains` entries
- Zero false positives (tests pass on current code without changes)
