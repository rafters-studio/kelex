# Stress Test Deep Assertions Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Expand stress tests with data-driven assertion tables that verify introspection fidelity, component mapping, and generated JSX correctness for all 11 complex schemas.

**Architecture:** Extend the existing `SchemaTestCase` interface in `test/stress/stress.spec.ts` with `expectedFields`, `expectedCodeContains`, `expectedImports`, and add 3 new `it()` blocks to the test loop. All assertion data is co-located with the schema entry for maintainability.

**Tech Stack:** Vitest, Zod v4, kelex introspection/mapping/codegen pipeline

---

## Mapping Rule Reference

These rules fire in order (first match wins). Every `expectedFields[].component` value in the assertion tables below was derived from this logic:

1. `object` -> `Fieldset`
2. `array` -> `FieldArray`
3. `union` -> `UnionSwitch`
4. `tuple` -> `Fieldset`
5. `record` -> `FieldArray`
6. `boolean` -> `Checkbox`
7. `enum` (<=4 values) -> `RadioGroup`
8. `enum` (>4 values) -> `Select`
9. `date` -> `DatePicker`
10. `number` (bounded, range <=100) -> `Slider`
11. `number` -> `Input`
12. `string` (format:email) -> `Input`
13. `string` (format:url) -> `Input`
14. `string` (maxLength > 100) -> `Textarea`
15. `string` (default) -> `Input`

---

### Task 1: Expand SchemaTestCase interface and add new imports

**Files:**
- Modify: `test/stress/stress.spec.ts:1-24`

**Step 1: Add the FieldAssertion interface and expand SchemaTestCase**

Add these types after the existing imports, replacing the existing `SchemaTestCase` interface:

```ts
import type { FieldConstraints, FieldType } from "../../src/introspection";
import type { ComponentType } from "../../src/mapping";
import { resolveField } from "../../src/mapping";

interface FieldAssertion {
  name: string;
  type: FieldType;
  isOptional?: boolean;
  isNullable?: boolean;
  component: ComponentType;
  constraints?: Partial<FieldConstraints>;
  nestedPaths?: string[];
}

interface SchemaTestCase {
  name: string;
  schema: unknown;
  expectedHardFeatures: string[];
  expectedFields: FieldAssertion[];
  expectedCodeContains: string[];
  expectedCodeExcludes?: string[];
  expectedImports: ComponentType[];
  expectedWarningCount?: number;
}
```

**Step 2: Run typecheck to verify the expanded interface compiles**

Run: `pnpm typecheck`
Expected: Errors because existing schema entries don't have the new required fields yet. That's expected -- we'll fill them in next.

**Step 3: Commit the type changes**

```bash
git add test/stress/stress.spec.ts
git commit -m "test(stress): expand SchemaTestCase with assertion fields"
```

---

### Task 2: Add assertion tables for schemas 01-04

**Files:**
- Modify: `test/stress/stress.spec.ts` (the `schemas` array entries)

**Step 1: Replace schema 01 entry with full assertions**

Schema 01 Healthcare: Patient Intake has 10 fields.

```ts
{
  name: "01 Healthcare: Patient Intake",
  schema: patientIntakeSchema,
  expectedHardFeatures: ["nested object (address)"],
  expectedFields: [
    { name: "firstName", type: "string", component: "Input", constraints: { minLength: 1, maxLength: 50 } },
    { name: "lastName", type: "string", component: "Input", constraints: { minLength: 1, maxLength: 50 } },
    { name: "dateOfBirth", type: "date", component: "DatePicker" },
    { name: "phone", type: "string", component: "Input" },
    { name: "email", type: "string", isOptional: true, component: "Input", constraints: { format: "email" } },
    {
      name: "address",
      type: "object",
      component: "Fieldset",
      nestedPaths: ["address.street", "address.city", "address.state", "address.zip"],
    },
    { name: "insuranceType", type: "enum", component: "RadioGroup" },
    { name: "allergies", type: "string", isOptional: true, component: "Textarea", constraints: { maxLength: 500 } },
    { name: "emergencyContactName", type: "string", isOptional: true, component: "Input", constraints: { maxLength: 100 } },
    { name: "emergencyContactPhone", type: "string", isOptional: true, component: "Input" },
  ],
  expectedCodeContains: [
    "<RadioGroup",
    "<Textarea",
    "<DatePicker",
    "CardTitle",
    'name="address.street"',
    'name="address.city"',
  ],
  expectedImports: ["Input", "RadioGroup", "DatePicker", "Textarea"],
},
```

**Step 2: Replace schema 02 entry with full assertions**

Schema 02 E-commerce: Product Listing has 9 fields. Note: `title` has maxLength:200 > 100, so it maps to `Textarea`.

```ts
{
  name: "02 E-commerce: Product Listing",
  schema: productListingSchema,
  expectedHardFeatures: [
    "nested object (price)",
    "array (tags, images)",
    "discriminated union (attributes)",
  ],
  expectedFields: [
    { name: "title", type: "string", component: "Textarea", constraints: { minLength: 1, maxLength: 200 } },
    { name: "description", type: "string", component: "Textarea", constraints: { minLength: 10, maxLength: 5000 } },
    { name: "sku", type: "string", component: "Input" },
    {
      name: "price",
      type: "object",
      component: "Fieldset",
      nestedPaths: ["price.amount", "price.currency"],
    },
    { name: "category", type: "enum", component: "Select" },
    { name: "tags", type: "array", component: "FieldArray" },
    { name: "images", type: "array", component: "FieldArray" },
    {
      name: "attributes",
      type: "union",
      component: "UnionSwitch",
      nestedPaths: ["attributes.type"],
    },
    { name: "isActive", type: "boolean", component: "Checkbox" },
  ],
  expectedCodeContains: [
    "<Textarea",
    "<Select",
    "<Checkbox",
    'mode="array"',
    "CardTitle",
    'Select.Item value="physical"',
    'Select.Item value="digital"',
  ],
  expectedImports: ["Textarea", "Input", "Select", "Checkbox"],
},
```

**Step 3: Replace schema 03 entry with full assertions**

Schema 03 Finance: Loan Application has 10 fields. Uses `.check()` on root (runtime only, no introspection impact).

```ts
{
  name: "03 Finance: Loan Application",
  schema: loanApplicationSchema,
  expectedHardFeatures: [
    "discriminated union (loanDetails)",
    ".check() on root",
  ],
  expectedFields: [
    { name: "applicantFirstName", type: "string", component: "Input", constraints: { minLength: 1, maxLength: 50 } },
    { name: "applicantLastName", type: "string", component: "Input", constraints: { minLength: 1, maxLength: 50 } },
    { name: "email", type: "string", component: "Input", constraints: { format: "email" } },
    { name: "phone", type: "string", component: "Input" },
    { name: "requestedAmount", type: "number", component: "Input" },
    { name: "loanTerm", type: "enum", component: "Select" },
    { name: "purpose", type: "string", component: "Textarea", constraints: { minLength: 10, maxLength: 1000 } },
    {
      name: "loanDetails",
      type: "union",
      component: "UnionSwitch",
      nestedPaths: ["loanDetails.loanType"],
    },
    { name: "hasCoSigner", type: "boolean", component: "Checkbox" },
    { name: "agreeToTerms", type: "boolean", component: "Checkbox" },
  ],
  expectedCodeContains: [
    "<Select",
    "<Textarea",
    "<Checkbox",
    'Select.Item value="personal"',
    'Select.Item value="business"',
    "CardTitle",
  ],
  expectedImports: ["Input", "Select", "Textarea", "Checkbox"],
},
```

**Step 4: Replace schema 04 entry with full assertions**

Schema 04 HR: Job Application has 15 fields. Tests nullable+optional URLs, arrays of objects, simple string arrays.

```ts
{
  name: "04 HR: Job Application",
  schema: jobApplicationSchema,
  expectedHardFeatures: [
    "array of objects (education, workExperience)",
    "array of strings (skills)",
    "nullable optional URL",
  ],
  expectedFields: [
    { name: "firstName", type: "string", component: "Input", constraints: { minLength: 1, maxLength: 50 } },
    { name: "lastName", type: "string", component: "Input", constraints: { minLength: 1, maxLength: 50 } },
    { name: "email", type: "string", component: "Input", constraints: { format: "email" } },
    { name: "phone", type: "string", component: "Input", constraints: { minLength: 10, maxLength: 20 } },
    { name: "linkedinUrl", type: "string", isOptional: true, isNullable: true, component: "Input", constraints: { format: "url" } },
    { name: "portfolioUrl", type: "string", isOptional: true, isNullable: true, component: "Input", constraints: { format: "url" } },
    { name: "positionApplied", type: "string", component: "Input", constraints: { minLength: 1, maxLength: 100 } },
    { name: "desiredSalary", type: "number", isOptional: true, component: "Input" },
    { name: "availableStartDate", type: "date", component: "DatePicker" },
    { name: "educationLevel", type: "enum", component: "Select" },
    { name: "education", type: "array", component: "FieldArray" },
    { name: "workExperience", type: "array", component: "FieldArray" },
    { name: "coverLetter", type: "string", component: "Textarea", constraints: { minLength: 50, maxLength: 5000 } },
    { name: "skills", type: "array", component: "FieldArray" },
    { name: "willingToRelocate", type: "boolean", component: "Checkbox" },
    { name: "authorizedToWork", type: "boolean", component: "Checkbox" },
  ],
  expectedCodeContains: [
    'mode="array"',
    "<Textarea",
    "<Select",
    "<DatePicker",
    "<Checkbox",
    'type="url"',
  ],
  expectedImports: ["Input", "Select", "DatePicker", "Textarea", "Checkbox"],
},
```

**Step 5: Run typecheck (will still fail for schemas 05-11 -- that's OK)**

Run: `pnpm typecheck`
Expected: Type errors for schemas 05-11 only.

---

### Task 3: Add assertion tables for schemas 05-08

**Files:**
- Modify: `test/stress/stress.spec.ts`

**Step 1: Replace schema 05 entry**

Schema 05 Real Estate: Property Listing uses `.and()` intersection. After flattening: baseListing(6) + locationDetails(5) + propertyDetails(8) = 19 fields.

Key mapping notes:
- `title` maxLength:200 > 100 -> Textarea
- `description` maxLength:5000 > 100 -> Textarea
- `price` no max -> Input[number]
- `propertyType` 5 values -> Select
- `status` 4 values -> RadioGroup
- `latitude` range 180 > 100 -> Input[number]
- `longitude` range 360 > 100 -> Input[number]
- `bedrooms` range 20 <= 100 -> Slider
- `bathrooms` range 20 <= 100 -> Slider
- `squareFeet` no max -> Input[number]
- `yearBuilt` range 226 > 100 -> Input[number]
- `garage` 4 values -> RadioGroup

```ts
{
  name: "05 Real Estate: Property Listing",
  schema: propertyListingSchema,
  expectedHardFeatures: [
    "intersection (.and())",
    "deeply nested object (address inside location)",
    "array (amenities)",
  ],
  expectedFields: [
    { name: "title", type: "string", component: "Textarea", constraints: { minLength: 5, maxLength: 200 } },
    { name: "description", type: "string", component: "Textarea", constraints: { minLength: 20, maxLength: 5000 } },
    { name: "price", type: "number", component: "Input" },
    { name: "propertyType", type: "enum", component: "Select" },
    { name: "status", type: "enum", component: "RadioGroup" },
    { name: "listedDate", type: "date", component: "DatePicker" },
    {
      name: "address",
      type: "object",
      component: "Fieldset",
      nestedPaths: ["address.street", "address.city", "address.state", "address.zip"],
    },
    { name: "county", type: "string", component: "Input", constraints: { maxLength: 100 } },
    { name: "latitude", type: "number", component: "Input" },
    { name: "longitude", type: "number", component: "Input" },
    { name: "schoolDistrict", type: "string", isOptional: true, component: "Input", constraints: { maxLength: 100 } },
    { name: "bedrooms", type: "number", component: "Slider" },
    { name: "bathrooms", type: "number", component: "Slider" },
    { name: "squareFeet", type: "number", component: "Input" },
    { name: "lotSize", type: "number", isOptional: true, component: "Input" },
    { name: "yearBuilt", type: "number", component: "Input" },
    { name: "garage", type: "enum", component: "RadioGroup" },
    { name: "amenities", type: "array", component: "FieldArray" },
    { name: "hoaFee", type: "number", isOptional: true, component: "Input" },
  ],
  expectedCodeContains: [
    "<Textarea",
    "<Select",
    "<RadioGroup",
    "<DatePicker",
    "<Slider",
    'mode="array"',
    "CardTitle",
    'name="address.street"',
  ],
  expectedImports: ["Textarea", "Input", "Select", "RadioGroup", "DatePicker", "Slider"],
},
```

**Step 2: Replace schema 06 entry**

Schema 06 Education: Course Enrollment has 13 fields. Key: `tuple` maps to `Fieldset` (rule 4), `record` maps to `FieldArray` (rule 5).

```ts
{
  name: "06 Education: Course Enrollment",
  schema: courseEnrollmentSchema,
  expectedHardFeatures: [
    "tuple (semester)",
    "record (preferences)",
    "array of objects (courses)",
  ],
  expectedFields: [
    { name: "studentId", type: "string", component: "Input" },
    { name: "firstName", type: "string", component: "Input", constraints: { minLength: 1, maxLength: 50 } },
    { name: "lastName", type: "string", component: "Input", constraints: { minLength: 1, maxLength: 50 } },
    { name: "email", type: "string", component: "Input", constraints: { format: "email" } },
    { name: "semester", type: "tuple", component: "Fieldset" },
    { name: "department", type: "enum", component: "Select" },
    { name: "academicLevel", type: "enum", component: "RadioGroup" },
    { name: "courses", type: "array", component: "FieldArray" },
    { name: "mealPlan", type: "enum", isOptional: true, component: "RadioGroup" },
    { name: "housingPreference", type: "enum", component: "RadioGroup" },
    { name: "preferences", type: "record", component: "FieldArray" },
    { name: "financialAidApplied", type: "boolean", component: "Checkbox" },
    { name: "enrollmentDate", type: "date", component: "DatePicker" },
  ],
  expectedCodeContains: [
    'mode="array"',
    "<Select",
    "<RadioGroup",
    "<Checkbox",
    "<DatePicker",
    "CardTitle",
  ],
  expectedImports: ["Input", "Select", "RadioGroup", "Checkbox", "DatePicker"],
},
```

**Step 3: Replace schema 07 entry**

Schema 07 Logistics: Shipment Booking has 10 fields. Key: two nested address objects, array of objects with nested dimensions, 3-variant discriminated union.

```ts
{
  name: "07 Logistics: Shipment Booking",
  schema: shipmentBookingSchema,
  expectedHardFeatures: [
    "discriminated union (shippingMethod)",
    "nested objects (addresses)",
    "array of objects (packages)",
  ],
  expectedFields: [
    { name: "bookingReference", type: "string", component: "Input" },
    { name: "shipperName", type: "string", component: "Textarea", constraints: { minLength: 1, maxLength: 200 } },
    { name: "shipperEmail", type: "string", component: "Input", constraints: { format: "email" } },
    {
      name: "originAddress",
      type: "object",
      component: "Fieldset",
      nestedPaths: ["originAddress.street", "originAddress.city", "originAddress.country"],
    },
    {
      name: "destinationAddress",
      type: "object",
      component: "Fieldset",
      nestedPaths: ["destinationAddress.street", "destinationAddress.city", "destinationAddress.country"],
    },
    { name: "packages", type: "array", component: "FieldArray" },
    {
      name: "shippingMethod",
      type: "union",
      component: "UnionSwitch",
      nestedPaths: ["shippingMethod.method"],
    },
    { name: "pickupDate", type: "date", component: "DatePicker" },
    { name: "insuranceRequired", type: "boolean", component: "Checkbox" },
    { name: "specialInstructions", type: "string", isOptional: true, component: "Textarea", constraints: { maxLength: 2000 } },
  ],
  expectedCodeContains: [
    'mode="array"',
    "<Textarea",
    "<DatePicker",
    "<Checkbox",
    "CardTitle",
    'Select.Item value="ground"',
    'Select.Item value="air"',
    'Select.Item value="sea"',
  ],
  expectedImports: ["Input", "Textarea", "DatePicker", "Checkbox", "Select"],
},
```

**Step 4: Replace schema 08 entry**

Schema 08 Legal: Contract Intake has 20 fields. Tests branded type (passes through as string), nullish fields (isOptional + isNullable).

```ts
{
  name: "08 Legal: Contract Intake",
  schema: contractIntakeSchema,
  expectedHardFeatures: ["branded type (CaseNumber)", "nullish fields"],
  expectedFields: [
    { name: "caseNumber", type: "string", component: "Input" },
    { name: "clientFirstName", type: "string", component: "Input", constraints: { minLength: 1, maxLength: 50 } },
    { name: "clientLastName", type: "string", component: "Input", constraints: { minLength: 1, maxLength: 50 } },
    { name: "clientEmail", type: "string", component: "Input", constraints: { format: "email" } },
    { name: "clientPhone", type: "string", component: "Input", constraints: { minLength: 10, maxLength: 20 } },
    { name: "contractType", type: "enum", component: "Select" },
    { name: "effectiveDate", type: "date", component: "DatePicker" },
    { name: "expirationDate", type: "date", isOptional: true, component: "DatePicker" },
    { name: "contractValue", type: "number", component: "Input" },
    { name: "jurisdiction", type: "string", component: "Input", constraints: { minLength: 1, maxLength: 100 } },
    { name: "governingLaw", type: "string", component: "Input", constraints: { minLength: 1, maxLength: 100 } },
    { name: "counterpartyName", type: "string", component: "Textarea", constraints: { minLength: 1, maxLength: 200 } },
    { name: "counterpartyEmail", type: "string", isOptional: true, isNullable: true, component: "Input", constraints: { format: "email" } },
    { name: "contractSummary", type: "string", component: "Textarea", constraints: { minLength: 50, maxLength: 10000 } },
    { name: "specialClauses", type: "string", isOptional: true, isNullable: true, component: "Textarea", constraints: { maxLength: 5000 } },
    { name: "confidentialityLevel", type: "enum", component: "RadioGroup" },
    { name: "requiresNotarization", type: "boolean", component: "Checkbox" },
    { name: "witnessRequired", type: "boolean", component: "Checkbox" },
    { name: "previousCaseNumber", type: "string", isOptional: true, isNullable: true, component: "Input" },
    { name: "notes", type: "string", isOptional: true, isNullable: true, component: "Textarea", constraints: { maxLength: 5000 } },
  ],
  expectedCodeContains: [
    "<Select",
    "<RadioGroup",
    "<Textarea",
    "<DatePicker",
    "<Checkbox",
    'type="email"',
  ],
  expectedImports: ["Input", "Select", "RadioGroup", "Textarea", "DatePicker", "Checkbox"],
},
```

---

### Task 4: Add assertion tables for schemas 09-11

**Files:**
- Modify: `test/stress/stress.spec.ts`

**Step 1: Replace schema 09 entry**

Schema 09 SaaS: User Settings has 15 fields. Key: `itemsPerPage` range 90 <= 100 -> Slider, nested notification object, record of booleans.

```ts
{
  name: "09 SaaS: User Settings",
  schema: userSettingsSchema,
  expectedHardFeatures: [
    "nested object (notifications)",
    "record (featureFlags)",
  ],
  expectedFields: [
    { name: "displayName", type: "string", component: "Input", constraints: { minLength: 1, maxLength: 50 } },
    { name: "email", type: "string", component: "Input", constraints: { format: "email" } },
    { name: "avatarUrl", type: "string", isOptional: true, component: "Input", constraints: { format: "url" } },
    { name: "theme", type: "enum", component: "RadioGroup" },
    { name: "locale", type: "enum", component: "Select" },
    { name: "timezone", type: "string", component: "Input", constraints: { minLength: 1, maxLength: 50 } },
    { name: "dateFormat", type: "enum", component: "RadioGroup" },
    {
      name: "notifications",
      type: "object",
      component: "Fieldset",
      nestedPaths: ["notifications.emailDigest", "notifications.pushNotifications"],
    },
    { name: "featureFlags", type: "record", component: "FieldArray" },
    { name: "itemsPerPage", type: "number", component: "Slider" },
    { name: "defaultView", type: "enum", component: "RadioGroup" },
    { name: "sidebarCollapsed", type: "boolean", component: "Checkbox" },
    { name: "accessibilityMode", type: "boolean", component: "Checkbox" },
    { name: "twoFactorEnabled", type: "boolean", component: "Checkbox" },
    { name: "apiKeyPrefix", type: "string", isOptional: true, component: "Input" },
  ],
  expectedCodeContains: [
    "<RadioGroup",
    "<Select",
    "<Checkbox",
    "<Slider",
    "CardTitle",
    'type="url"',
  ],
  expectedImports: ["Input", "RadioGroup", "Select", "Checkbox", "Slider"],
},
```

**Step 2: Replace schema 10 entry**

Schema 10 Insurance: Claims Submission has 10 fields. Key: deeply nested claimant.address, 3-variant discriminated union, array of objects.

```ts
{
  name: "10 Insurance: Claims Submission",
  schema: claimsSubmissionSchema,
  expectedHardFeatures: [
    "nested object (claimant with nested address)",
    "discriminated union (claimDetails)",
    "array of objects (documents)",
  ],
  expectedFields: [
    {
      name: "claimant",
      type: "object",
      component: "Fieldset",
      nestedPaths: ["claimant.policyNumber", "claimant.firstName", "claimant.address"],
    },
    { name: "incidentDate", type: "date", component: "DatePicker" },
    { name: "dateReported", type: "date", component: "DatePicker" },
    { name: "claimDescription", type: "string", component: "Textarea", constraints: { minLength: 20, maxLength: 5000 } },
    { name: "estimatedLoss", type: "number", component: "Input" },
    {
      name: "claimDetails",
      type: "union",
      component: "UnionSwitch",
      nestedPaths: ["claimDetails.claimType"],
    },
    { name: "documents", type: "array", component: "FieldArray" },
    { name: "hasWitnesses", type: "boolean", component: "Checkbox" },
    { name: "witnessInfo", type: "string", isOptional: true, component: "Textarea", constraints: { maxLength: 2000 } },
    { name: "fraudAcknowledgment", type: "boolean", component: "Checkbox" },
  ],
  expectedCodeContains: [
    "<Textarea",
    "<DatePicker",
    "<Checkbox",
    'mode="array"',
    "CardTitle",
    'Select.Item value="auto"',
    'Select.Item value="home"',
    'Select.Item value="health"',
  ],
  expectedImports: ["Input", "Textarea", "DatePicker", "Checkbox", "Select"],
},
```

**Step 3: Replace schema 11 entry**

Schema 11 Government: Tax Filing has 21 fields. Most complex schema: array of discriminated unions, cross-field `.check()`, conditional required fields.

Key mapping: `taxYear` min:2020 max:2026, range = 6 <= 100 -> Slider. `filingStatus` 5 values -> Select.

```ts
{
  name: "11 Government: Tax Filing",
  schema: taxFilingSchema,
  expectedHardFeatures: [
    ".check() cross-field validation",
    "nested object (address, bankAccount, itemizedDeductions)",
    "array of discriminated unions (incomeSources)",
    "array of objects (dependents)",
    "conditional required fields",
  ],
  expectedFields: [
    { name: "taxYear", type: "number", component: "Slider" },
    { name: "filingStatus", type: "enum", component: "Select" },
    { name: "firstName", type: "string", component: "Input", constraints: { minLength: 1, maxLength: 50 } },
    { name: "lastName", type: "string", component: "Input", constraints: { minLength: 1, maxLength: 50 } },
    { name: "ssn", type: "string", component: "Input" },
    { name: "dateOfBirth", type: "date", component: "DatePicker" },
    { name: "phone", type: "string", component: "Input", constraints: { minLength: 10, maxLength: 20 } },
    { name: "email", type: "string", component: "Input", constraints: { format: "email" } },
    { name: "spouseFirstName", type: "string", isOptional: true, component: "Input", constraints: { minLength: 1, maxLength: 50 } },
    { name: "spouseLastName", type: "string", isOptional: true, component: "Input", constraints: { minLength: 1, maxLength: 50 } },
    { name: "spouseSsn", type: "string", isOptional: true, component: "Input" },
    {
      name: "address",
      type: "object",
      component: "Fieldset",
      nestedPaths: ["address.street", "address.city", "address.state", "address.zip"],
    },
    { name: "claimingDependents", type: "boolean", component: "Checkbox" },
    { name: "dependents", type: "array", isOptional: true, component: "FieldArray" },
    { name: "incomeSources", type: "array", component: "FieldArray" },
    { name: "standardDeduction", type: "boolean", component: "Checkbox" },
    {
      name: "itemizedDeductions",
      type: "object",
      isOptional: true,
      component: "Fieldset",
      nestedPaths: ["itemizedDeductions.medicalExpenses", "itemizedDeductions.mortgageInterest"],
    },
    { name: "estimatedTaxPayments", type: "number", isOptional: true, component: "Input" },
    {
      name: "bankAccountForRefund",
      type: "object",
      isOptional: true,
      component: "Fieldset",
      nestedPaths: ["bankAccountForRefund.routingNumber", "bankAccountForRefund.accountType"],
    },
    { name: "signatureDate", type: "date", component: "DatePicker" },
    { name: "electronicSignature", type: "boolean", component: "Checkbox" },
  ],
  expectedCodeContains: [
    "<Select",
    "<Slider",
    "<DatePicker",
    "<Checkbox",
    'mode="array"',
    "CardTitle",
    'name="address.street"',
  ],
  expectedImports: ["Input", "Select", "Slider", "DatePicker", "Checkbox"],
},
```

**Step 4: Run typecheck**

Run: `pnpm typecheck`
Expected: PASS -- all schema entries now have required fields.

**Step 5: Commit assertion tables**

```bash
git add test/stress/stress.spec.ts
git commit -m "test(stress): add assertion tables for all 11 schemas"
```

---

### Task 5: Add the 3 new test blocks

**Files:**
- Modify: `test/stress/stress.spec.ts` (inside the `for (const testCase of schemas)` loop)

**Step 1: Add introspection fidelity test**

After the existing "should round-trip through schema writer" block, add:

```ts
it("should introspect all expected fields with correct types", () => {
  const descriptor = introspect(
    testCase.schema as Parameters<typeof introspect>[0],
    INTROSPECT_OPTS,
  );

  expect(descriptor.fields).toHaveLength(testCase.expectedFields.length);

  for (const expected of testCase.expectedFields) {
    const actual = descriptor.fields.find((f) => f.name === expected.name);
    expect(actual, `missing field: ${expected.name}`).toBeDefined();
    expect(actual!.type, `${expected.name} type`).toBe(expected.type);

    if (expected.isOptional !== undefined) {
      expect(actual!.isOptional, `${expected.name} isOptional`).toBe(expected.isOptional);
    }
    if (expected.isNullable !== undefined) {
      expect(actual!.isNullable, `${expected.name} isNullable`).toBe(expected.isNullable);
    }
    if (expected.constraints) {
      for (const [key, value] of Object.entries(expected.constraints)) {
        expect(
          actual!.constraints[key as keyof typeof actual.constraints],
          `${expected.name} constraint ${key}`,
        ).toBe(value);
      }
    }
  }
});
```

**Step 2: Add component mapping test**

```ts
it("should map fields to correct components", () => {
  const descriptor = introspect(
    testCase.schema as Parameters<typeof introspect>[0],
    INTROSPECT_OPTS,
  );

  for (const expected of testCase.expectedFields) {
    const field = descriptor.fields.find((f) => f.name === expected.name);
    if (!field) continue;

    const config = resolveField(field);
    expect(config.component, `${expected.name} -> ${expected.component}`).toBe(expected.component);
  }
});
```

**Step 3: Add JSX structure test**

```ts
it("should generate correct JSX structure", () => {
  const result = generate({
    schema: testCase.schema as Parameters<typeof generate>[0]["schema"],
    formName: `${testCase.name.replace(/[^a-zA-Z]/g, "")}Form`,
    schemaImportPath: "./schema",
    schemaExportName: "schema",
  });

  for (const expected of testCase.expectedCodeContains) {
    expect(result.code, `code should contain: ${expected}`).toContain(expected);
  }

  for (const excluded of testCase.expectedCodeExcludes ?? []) {
    expect(result.code, `code should not contain: ${excluded}`).not.toContain(excluded);
  }

  for (const field of testCase.expectedFields) {
    for (const path of field.nestedPaths ?? []) {
      const staticMatch = result.code.includes(`"${path}"`);
      const templateMatch = result.code.includes(path);
      expect(
        staticMatch || templateMatch,
        `missing nested path: ${path}`,
      ).toBe(true);
    }
  }

  for (const component of testCase.expectedImports) {
    expect(result.code, `missing import: ${component}`).toContain(`${component},`);
  }

  const expectedWarnings = testCase.expectedWarningCount ?? 0;
  expect(result.warnings).toHaveLength(expectedWarnings);
});
```

**Step 4: Run the full test suite**

Run: `pnpm vitest run test/stress/stress.spec.ts`
Expected: All 55 tests pass (11 schemas x 5 tests each).

**Step 5: If any assertion mismatches, fix the assertion table**

Common fixes:
- Field count mismatch: re-examine the schema for fields you missed
- Component mismatch: re-check the mapping rules (order matters, first match wins)
- Constraint mismatch: verify what `extractConstraints` actually extracts (e.g., regex patterns may differ from source)
- Nested path mismatch: check exact path format in generated code (static `"path"` vs template `` `path` ``)

**Step 6: Run full test suite to verify nothing regressed**

Run: `pnpm vitest run`
Expected: All tests pass (existing + new).

**Step 7: Commit**

```bash
git add test/stress/stress.spec.ts
git commit -m "test(stress): add deep assertions for pipeline fidelity and codegen correctness

Adds 3 new test blocks per schema (33 new tests total):
- Introspection field types, optionality, and constraints
- Component mapping correctness
- Generated JSX structure, nested paths, and imports"
```

---

### Task 6: Verify and clean up

**Step 1: Run the stress tests one final time with verbose output**

Run: `pnpm vitest run test/stress/stress.spec.ts --reporter=verbose`
Expected: 55 passing tests, no warnings.

**Step 2: Run lint**

Run: `pnpm biome check test/stress/stress.spec.ts`
Expected: Clean.

**Step 3: Run full suite**

Run: `pnpm vitest run`
Expected: All tests pass.
