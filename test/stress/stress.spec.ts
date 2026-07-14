import { describe, expect, it } from "vitest";
import type { FieldConstraints, FieldType } from "../../src/introspection";
import { introspect } from "../../src/introspection";
import type { ComponentType } from "../../src/mapping";
import { resolveField } from "../../src/mapping";
import { writeSchema } from "../../src/schema-writer/writer";
import { evaluateSchemaCode } from "../helpers/evaluate-schema";

import { patientIntakeSchema } from "./01-healthcare-patient-intake";
import { productListingSchema } from "./02-ecommerce-product-listing";
import { loanApplicationSchema } from "./03-finance-loan-application";
import { jobApplicationSchema } from "./04-hr-job-application";
import { propertyListingSchema } from "./05-realestate-property-listing";
import { courseEnrollmentSchema } from "./06-education-course-enrollment";
import { shipmentBookingSchema } from "./07-logistics-shipment-booking";
import { contractIntakeSchema } from "./08-legal-contract-intake";
import { userSettingsSchema } from "./09-saas-user-settings";
import { claimsSubmissionSchema } from "./10-insurance-claims-submission";
import { taxFilingSchema } from "./11-government-tax-filing";

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
  expectedFields: FieldAssertion[];
}

const schemas: SchemaTestCase[] = [
  {
    name: "01 Healthcare: Patient Intake",
    schema: patientIntakeSchema,
    expectedFields: [
      {
        name: "firstName",
        type: "string",
        component: "Input",
        constraints: { minLength: 1, maxLength: 50 },
      },
      {
        name: "lastName",
        type: "string",
        component: "Input",
        constraints: { minLength: 1, maxLength: 50 },
      },
      { name: "dateOfBirth", type: "date", component: "DatePicker" },
      { name: "phone", type: "string", component: "Input" },
      {
        name: "email",
        type: "string",
        isOptional: true,
        component: "Input",
        constraints: { format: "email" },
      },
      {
        name: "address",
        type: "object",
        component: "Fieldset",
        nestedPaths: [
          "address.street",
          "address.city",
          "address.state",
          "address.zip",
        ],
      },
      { name: "insuranceType", type: "enum", component: "RadioGroup" },
      {
        name: "allergies",
        type: "string",
        isOptional: true,
        component: "Textarea",
        constraints: { maxLength: 500 },
      },
      {
        name: "emergencyContactName",
        type: "string",
        isOptional: true,
        component: "Input",
        constraints: { maxLength: 100 },
      },
      {
        name: "emergencyContactPhone",
        type: "string",
        isOptional: true,
        component: "Input",
      },
    ],
  },
  {
    name: "02 E-commerce: Product Listing",
    schema: productListingSchema,
    expectedFields: [
      {
        name: "title",
        type: "string",
        component: "Textarea",
        constraints: { minLength: 1, maxLength: 200 },
      },
      {
        name: "description",
        type: "string",
        component: "Textarea",
        constraints: { minLength: 10, maxLength: 5000 },
      },
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
  },
  {
    name: "03 Finance: Loan Application",
    schema: loanApplicationSchema,
    expectedFields: [
      {
        name: "applicantFirstName",
        type: "string",
        component: "Input",
        constraints: { minLength: 1, maxLength: 50 },
      },
      {
        name: "applicantLastName",
        type: "string",
        component: "Input",
        constraints: { minLength: 1, maxLength: 50 },
      },
      {
        name: "email",
        type: "string",
        component: "Input",
        constraints: { format: "email" },
      },
      { name: "phone", type: "string", component: "Input" },
      { name: "requestedAmount", type: "number", component: "Input" },
      { name: "loanTerm", type: "enum", component: "Select" },
      {
        name: "purpose",
        type: "string",
        component: "Textarea",
        constraints: { minLength: 10, maxLength: 1000 },
      },
      {
        name: "loanDetails",
        type: "union",
        component: "UnionSwitch",
        nestedPaths: ["loanDetails.loanType"],
      },
      { name: "hasCoSigner", type: "boolean", component: "Checkbox" },
      { name: "agreeToTerms", type: "boolean", component: "Checkbox" },
    ],
  },
  {
    name: "04 HR: Job Application",
    schema: jobApplicationSchema,
    expectedFields: [
      {
        name: "firstName",
        type: "string",
        component: "Input",
        constraints: { minLength: 1, maxLength: 50 },
      },
      {
        name: "lastName",
        type: "string",
        component: "Input",
        constraints: { minLength: 1, maxLength: 50 },
      },
      {
        name: "email",
        type: "string",
        component: "Input",
        constraints: { format: "email" },
      },
      {
        name: "phone",
        type: "string",
        component: "Input",
        constraints: { minLength: 10, maxLength: 20 },
      },
      {
        name: "linkedinUrl",
        type: "string",
        isOptional: true,
        isNullable: true,
        component: "Input",
        constraints: { format: "url" },
      },
      {
        name: "portfolioUrl",
        type: "string",
        isOptional: true,
        isNullable: true,
        component: "Input",
        constraints: { format: "url" },
      },
      {
        name: "positionApplied",
        type: "string",
        component: "Input",
        constraints: { minLength: 1, maxLength: 100 },
      },
      {
        name: "desiredSalary",
        type: "number",
        isOptional: true,
        component: "Input",
      },
      { name: "availableStartDate", type: "date", component: "DatePicker" },
      { name: "educationLevel", type: "enum", component: "Select" },
      { name: "education", type: "array", component: "FieldArray" },
      { name: "workExperience", type: "array", component: "FieldArray" },
      {
        name: "coverLetter",
        type: "string",
        component: "Textarea",
        constraints: { minLength: 50, maxLength: 5000 },
      },
      { name: "skills", type: "array", component: "FieldArray" },
      { name: "willingToRelocate", type: "boolean", component: "Checkbox" },
      { name: "authorizedToWork", type: "boolean", component: "Checkbox" },
    ],
  },
  {
    name: "05 Real Estate: Property Listing",
    schema: propertyListingSchema,
    expectedFields: [
      {
        name: "title",
        type: "string",
        component: "Textarea",
        constraints: { minLength: 5, maxLength: 200 },
      },
      {
        name: "description",
        type: "string",
        component: "Textarea",
        constraints: { minLength: 20, maxLength: 5000 },
      },
      { name: "price", type: "number", component: "Input" },
      { name: "propertyType", type: "enum", component: "Select" },
      { name: "status", type: "enum", component: "RadioGroup" },
      { name: "listedDate", type: "date", component: "DatePicker" },
      {
        name: "address",
        type: "object",
        component: "Fieldset",
        nestedPaths: [
          "address.street",
          "address.city",
          "address.state",
          "address.zip",
        ],
      },
      {
        name: "county",
        type: "string",
        component: "Input",
        constraints: { maxLength: 100 },
      },
      { name: "latitude", type: "number", component: "Input" },
      { name: "longitude", type: "number", component: "Input" },
      {
        name: "schoolDistrict",
        type: "string",
        isOptional: true,
        component: "Input",
        constraints: { maxLength: 100 },
      },
      { name: "bedrooms", type: "number", component: "Slider" },
      { name: "bathrooms", type: "number", component: "Slider" },
      { name: "squareFeet", type: "number", component: "Input" },
      { name: "lotSize", type: "number", isOptional: true, component: "Input" },
      { name: "yearBuilt", type: "number", component: "Input" },
      { name: "garage", type: "enum", component: "RadioGroup" },
      { name: "amenities", type: "array", component: "FieldArray" },
      { name: "hoaFee", type: "number", isOptional: true, component: "Input" },
    ],
  },
  {
    name: "06 Education: Course Enrollment",
    schema: courseEnrollmentSchema,
    expectedFields: [
      { name: "studentId", type: "string", component: "Input" },
      {
        name: "firstName",
        type: "string",
        component: "Input",
        constraints: { minLength: 1, maxLength: 50 },
      },
      {
        name: "lastName",
        type: "string",
        component: "Input",
        constraints: { minLength: 1, maxLength: 50 },
      },
      {
        name: "email",
        type: "string",
        component: "Input",
        constraints: { format: "email" },
      },
      { name: "semester", type: "tuple", component: "Fieldset" },
      { name: "department", type: "enum", component: "Select" },
      { name: "academicLevel", type: "enum", component: "RadioGroup" },
      { name: "courses", type: "array", component: "FieldArray" },
      {
        name: "mealPlan",
        type: "enum",
        isOptional: true,
        component: "RadioGroup",
      },
      { name: "housingPreference", type: "enum", component: "RadioGroup" },
      { name: "preferences", type: "record", component: "FieldArray" },
      { name: "financialAidApplied", type: "boolean", component: "Checkbox" },
      { name: "enrollmentDate", type: "date", component: "DatePicker" },
    ],
  },
  {
    name: "07 Logistics: Shipment Booking",
    schema: shipmentBookingSchema,
    expectedFields: [
      { name: "bookingReference", type: "string", component: "Input" },
      {
        name: "shipperName",
        type: "string",
        component: "Textarea",
        constraints: { minLength: 1, maxLength: 200 },
      },
      {
        name: "shipperEmail",
        type: "string",
        component: "Input",
        constraints: { format: "email" },
      },
      {
        name: "originAddress",
        type: "object",
        component: "Fieldset",
        nestedPaths: [
          "originAddress.street",
          "originAddress.city",
          "originAddress.country",
        ],
      },
      {
        name: "destinationAddress",
        type: "object",
        component: "Fieldset",
        nestedPaths: [
          "destinationAddress.street",
          "destinationAddress.city",
          "destinationAddress.country",
        ],
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
      {
        name: "specialInstructions",
        type: "string",
        isOptional: true,
        component: "Textarea",
        constraints: { maxLength: 2000 },
      },
    ],
  },
  {
    name: "08 Legal: Contract Intake",
    schema: contractIntakeSchema,
    expectedFields: [
      { name: "caseNumber", type: "string", component: "Input" },
      {
        name: "clientFirstName",
        type: "string",
        component: "Input",
        constraints: { minLength: 1, maxLength: 50 },
      },
      {
        name: "clientLastName",
        type: "string",
        component: "Input",
        constraints: { minLength: 1, maxLength: 50 },
      },
      {
        name: "clientEmail",
        type: "string",
        component: "Input",
        constraints: { format: "email" },
      },
      {
        name: "clientPhone",
        type: "string",
        component: "Input",
        constraints: { minLength: 10, maxLength: 20 },
      },
      { name: "contractType", type: "enum", component: "Select" },
      { name: "effectiveDate", type: "date", component: "DatePicker" },
      {
        name: "expirationDate",
        type: "date",
        isOptional: true,
        component: "DatePicker",
      },
      { name: "contractValue", type: "number", component: "Input" },
      {
        name: "jurisdiction",
        type: "string",
        component: "Input",
        constraints: { minLength: 1, maxLength: 100 },
      },
      {
        name: "governingLaw",
        type: "string",
        component: "Input",
        constraints: { minLength: 1, maxLength: 100 },
      },
      {
        name: "counterpartyName",
        type: "string",
        component: "Textarea",
        constraints: { minLength: 1, maxLength: 200 },
      },
      {
        name: "counterpartyEmail",
        type: "string",
        isOptional: true,
        isNullable: true,
        component: "Input",
        constraints: { format: "email" },
      },
      {
        name: "contractSummary",
        type: "string",
        component: "Textarea",
        constraints: { minLength: 50, maxLength: 10000 },
      },
      {
        name: "specialClauses",
        type: "string",
        isOptional: true,
        isNullable: true,
        component: "Textarea",
        constraints: { maxLength: 5000 },
      },
      { name: "confidentialityLevel", type: "enum", component: "RadioGroup" },
      { name: "requiresNotarization", type: "boolean", component: "Checkbox" },
      { name: "witnessRequired", type: "boolean", component: "Checkbox" },
      {
        name: "previousCaseNumber",
        type: "string",
        isOptional: true,
        isNullable: true,
        component: "Input",
      },
      {
        name: "notes",
        type: "string",
        isOptional: true,
        isNullable: true,
        component: "Textarea",
        constraints: { maxLength: 5000 },
      },
    ],
  },
  {
    name: "09 SaaS: User Settings",
    schema: userSettingsSchema,
    expectedFields: [
      {
        name: "displayName",
        type: "string",
        component: "Input",
        constraints: { minLength: 1, maxLength: 50 },
      },
      {
        name: "email",
        type: "string",
        component: "Input",
        constraints: { format: "email" },
      },
      {
        name: "avatarUrl",
        type: "string",
        isOptional: true,
        component: "Input",
        constraints: { format: "url" },
      },
      { name: "theme", type: "enum", component: "RadioGroup" },
      { name: "locale", type: "enum", component: "Select" },
      {
        name: "timezone",
        type: "string",
        component: "Input",
        constraints: { minLength: 1, maxLength: 50 },
      },
      { name: "dateFormat", type: "enum", component: "RadioGroup" },
      {
        name: "notifications",
        type: "object",
        component: "Fieldset",
        nestedPaths: [
          "notifications.emailDigest",
          "notifications.pushNotifications",
        ],
      },
      { name: "featureFlags", type: "record", component: "FieldArray" },
      { name: "itemsPerPage", type: "number", component: "Slider" },
      { name: "defaultView", type: "enum", component: "RadioGroup" },
      { name: "sidebarCollapsed", type: "boolean", component: "Checkbox" },
      { name: "accessibilityMode", type: "boolean", component: "Checkbox" },
      { name: "twoFactorEnabled", type: "boolean", component: "Checkbox" },
      {
        name: "apiKeyPrefix",
        type: "string",
        isOptional: true,
        component: "Input",
      },
    ],
  },
  {
    name: "10 Insurance: Claims Submission",
    schema: claimsSubmissionSchema,
    expectedFields: [
      {
        name: "claimant",
        type: "object",
        component: "Fieldset",
        nestedPaths: [
          "claimant.policyNumber",
          "claimant.firstName",
          "claimant.address",
        ],
      },
      { name: "incidentDate", type: "date", component: "DatePicker" },
      { name: "dateReported", type: "date", component: "DatePicker" },
      {
        name: "claimDescription",
        type: "string",
        component: "Textarea",
        constraints: { minLength: 20, maxLength: 5000 },
      },
      { name: "estimatedLoss", type: "number", component: "Input" },
      {
        name: "claimDetails",
        type: "union",
        component: "UnionSwitch",
        nestedPaths: ["claimDetails.claimType"],
      },
      { name: "documents", type: "array", component: "FieldArray" },
      { name: "hasWitnesses", type: "boolean", component: "Checkbox" },
      {
        name: "witnessInfo",
        type: "string",
        isOptional: true,
        component: "Textarea",
        constraints: { maxLength: 2000 },
      },
      { name: "fraudAcknowledgment", type: "boolean", component: "Checkbox" },
    ],
  },
  {
    name: "11 Government: Tax Filing",
    schema: taxFilingSchema,
    expectedFields: [
      { name: "taxYear", type: "number", component: "Slider" },
      { name: "filingStatus", type: "enum", component: "Select" },
      {
        name: "firstName",
        type: "string",
        component: "Input",
        constraints: { minLength: 1, maxLength: 50 },
      },
      {
        name: "lastName",
        type: "string",
        component: "Input",
        constraints: { minLength: 1, maxLength: 50 },
      },
      { name: "ssn", type: "string", component: "Input" },
      { name: "dateOfBirth", type: "date", component: "DatePicker" },
      {
        name: "phone",
        type: "string",
        component: "Input",
        constraints: { minLength: 10, maxLength: 20 },
      },
      {
        name: "email",
        type: "string",
        component: "Input",
        constraints: { format: "email" },
      },
      {
        name: "spouseFirstName",
        type: "string",
        isOptional: true,
        component: "Input",
        constraints: { minLength: 1, maxLength: 50 },
      },
      {
        name: "spouseLastName",
        type: "string",
        isOptional: true,
        component: "Input",
        constraints: { minLength: 1, maxLength: 50 },
      },
      {
        name: "spouseSsn",
        type: "string",
        isOptional: true,
        component: "Input",
      },
      {
        name: "address",
        type: "object",
        component: "Fieldset",
        nestedPaths: [
          "address.street",
          "address.city",
          "address.state",
          "address.zip",
        ],
      },
      { name: "claimingDependents", type: "boolean", component: "Checkbox" },
      {
        name: "dependents",
        type: "array",
        isOptional: true,
        component: "FieldArray",
      },
      { name: "incomeSources", type: "array", component: "FieldArray" },
      { name: "standardDeduction", type: "boolean", component: "Checkbox" },
      {
        name: "itemizedDeductions",
        type: "object",
        isOptional: true,
        component: "Fieldset",
        nestedPaths: [
          "itemizedDeductions.medicalExpenses",
          "itemizedDeductions.mortgageInterest",
        ],
      },
      {
        name: "estimatedTaxPayments",
        type: "number",
        isOptional: true,
        component: "Input",
      },
      {
        name: "bankAccountForRefund",
        type: "object",
        isOptional: true,
        component: "Fieldset",
        nestedPaths: [
          "bankAccountForRefund.routingNumber",
          "bankAccountForRefund.accountType",
        ],
      },
      { name: "signatureDate", type: "date", component: "DatePicker" },
      { name: "electronicSignature", type: "boolean", component: "Checkbox" },
    ],
  },
];

const INTROSPECT_OPTS = {
  formName: "TestForm",
  schemaImportPath: "./schema",
  schemaExportName: "testSchema",
};

describe("Stress test: complex Zod v4 schemas", () => {
  for (const testCase of schemas) {
    describe(testCase.name, () => {
      it("should round-trip through schema writer", () => {
        const descriptor1 = introspect(
          testCase.schema as Parameters<typeof introspect>[0],
          INTROSPECT_OPTS,
        );

        const { code } = writeSchema({ form: descriptor1 });
        const roundTrippedSchema = evaluateSchemaCode(code);
        const descriptor2 = introspect(roundTrippedSchema, INTROSPECT_OPTS);

        // Field count must match
        expect(descriptor2.fields).toHaveLength(descriptor1.fields.length);

        // Each field: name and type must match
        for (let i = 0; i < descriptor1.fields.length; i++) {
          const f1 = descriptor1.fields[i];
          const f2 = descriptor2.fields[i];
          expect(f2.name).toBe(f1.name);
          expect(f2.type).toBe(f1.type);
        }

        console.log(`[ROUND-TRIP] ${testCase.name}`);
        console.log(
          `  Fields: ${descriptor1.fields.map((f) => f.name).join(", ")}`,
        );
        console.log(`  Field count: ${descriptor1.fields.length}`);
      });

      it("should introspect all expected fields with correct types", () => {
        const descriptor = introspect(
          testCase.schema as Parameters<typeof introspect>[0],
          INTROSPECT_OPTS,
        );

        expect(descriptor.fields).toHaveLength(testCase.expectedFields.length);

        for (const expected of testCase.expectedFields) {
          const actual = descriptor.fields.find(
            (f) => f.name === expected.name,
          );
          expect(actual, `missing field: ${expected.name}`).toBeDefined();
          expect(actual?.type, `${expected.name} type`).toBe(expected.type);

          if (expected.isOptional !== undefined) {
            expect(actual?.isOptional, `${expected.name} isOptional`).toBe(
              expected.isOptional,
            );
          }
          if (expected.isNullable !== undefined) {
            expect(actual?.isNullable, `${expected.name} isNullable`).toBe(
              expected.isNullable,
            );
          }
          if (expected.constraints) {
            for (const [key, value] of Object.entries(expected.constraints)) {
              expect(
                actual?.constraints[key as keyof typeof actual.constraints],
                `${expected.name} constraint ${key}`,
              ).toBe(value);
            }
          }
        }
      });

      it("should map fields to correct components", () => {
        const descriptor = introspect(
          testCase.schema as Parameters<typeof introspect>[0],
          INTROSPECT_OPTS,
        );

        for (const expected of testCase.expectedFields) {
          const field = descriptor.fields.find((f) => f.name === expected.name);
          expect(
            field,
            `missing field for component mapping: ${expected.name}`,
          ).toBeDefined();
          if (!field) continue;

          const config = resolveField(field);
          expect(
            config.component,
            `${expected.name} -> ${expected.component}`,
          ).toBe(expected.component);
        }
      });
    });
  }
});
