import { describe, expect, it } from "vitest";
import type { FieldConstraints, FieldType } from "../../src/introspection";
import { introspect } from "../../src/introspection";
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
  constraints?: Partial<FieldConstraints>;
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
        constraints: { minLength: 1, maxLength: 50 },
      },
      {
        name: "lastName",
        type: "string",
        constraints: { minLength: 1, maxLength: 50 },
      },
      { name: "dateOfBirth", type: "date" },
      { name: "phone", type: "string" },
      {
        name: "email",
        type: "string",
        isOptional: true,
        constraints: { format: "email" },
      },
      {
        name: "address",
        type: "object",
      },
      { name: "insuranceType", type: "enum" },
      {
        name: "allergies",
        type: "string",
        isOptional: true,
        constraints: { maxLength: 500 },
      },
      {
        name: "emergencyContactName",
        type: "string",
        isOptional: true,
        constraints: { maxLength: 100 },
      },
      {
        name: "emergencyContactPhone",
        type: "string",
        isOptional: true,
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
        constraints: { minLength: 1, maxLength: 200 },
      },
      {
        name: "description",
        type: "string",
        constraints: { minLength: 10, maxLength: 5000 },
      },
      { name: "sku", type: "string" },
      {
        name: "price",
        type: "object",
      },
      { name: "category", type: "enum" },
      { name: "tags", type: "array" },
      { name: "images", type: "array" },
      {
        name: "attributes",
        type: "union",
      },
      { name: "isActive", type: "boolean" },
    ],
  },
  {
    name: "03 Finance: Loan Application",
    schema: loanApplicationSchema,
    expectedFields: [
      {
        name: "applicantFirstName",
        type: "string",
        constraints: { minLength: 1, maxLength: 50 },
      },
      {
        name: "applicantLastName",
        type: "string",
        constraints: { minLength: 1, maxLength: 50 },
      },
      {
        name: "email",
        type: "string",
        constraints: { format: "email" },
      },
      { name: "phone", type: "string" },
      { name: "requestedAmount", type: "number" },
      { name: "loanTerm", type: "enum" },
      {
        name: "purpose",
        type: "string",
        constraints: { minLength: 10, maxLength: 1000 },
      },
      {
        name: "loanDetails",
        type: "union",
      },
      { name: "hasCoSigner", type: "boolean" },
      { name: "agreeToTerms", type: "boolean" },
    ],
  },
  {
    name: "04 HR: Job Application",
    schema: jobApplicationSchema,
    expectedFields: [
      {
        name: "firstName",
        type: "string",
        constraints: { minLength: 1, maxLength: 50 },
      },
      {
        name: "lastName",
        type: "string",
        constraints: { minLength: 1, maxLength: 50 },
      },
      {
        name: "email",
        type: "string",
        constraints: { format: "email" },
      },
      {
        name: "phone",
        type: "string",
        constraints: { minLength: 10, maxLength: 20 },
      },
      {
        name: "linkedinUrl",
        type: "string",
        isOptional: true,
        isNullable: true,
        constraints: { format: "url" },
      },
      {
        name: "portfolioUrl",
        type: "string",
        isOptional: true,
        isNullable: true,
        constraints: { format: "url" },
      },
      {
        name: "positionApplied",
        type: "string",
        constraints: { minLength: 1, maxLength: 100 },
      },
      {
        name: "desiredSalary",
        type: "number",
        isOptional: true,
      },
      { name: "availableStartDate", type: "date" },
      { name: "educationLevel", type: "enum" },
      { name: "education", type: "array" },
      { name: "workExperience", type: "array" },
      {
        name: "coverLetter",
        type: "string",
        constraints: { minLength: 50, maxLength: 5000 },
      },
      { name: "skills", type: "array" },
      { name: "willingToRelocate", type: "boolean" },
      { name: "authorizedToWork", type: "boolean" },
    ],
  },
  {
    name: "05 Real Estate: Property Listing",
    schema: propertyListingSchema,
    expectedFields: [
      {
        name: "title",
        type: "string",
        constraints: { minLength: 5, maxLength: 200 },
      },
      {
        name: "description",
        type: "string",
        constraints: { minLength: 20, maxLength: 5000 },
      },
      { name: "price", type: "number" },
      { name: "propertyType", type: "enum" },
      { name: "status", type: "enum" },
      { name: "listedDate", type: "date" },
      {
        name: "address",
        type: "object",
      },
      {
        name: "county",
        type: "string",
        constraints: { maxLength: 100 },
      },
      { name: "latitude", type: "number" },
      { name: "longitude", type: "number" },
      {
        name: "schoolDistrict",
        type: "string",
        isOptional: true,
        constraints: { maxLength: 100 },
      },
      { name: "bedrooms", type: "number" },
      { name: "bathrooms", type: "number" },
      { name: "squareFeet", type: "number" },
      { name: "lotSize", type: "number", isOptional: true },
      { name: "yearBuilt", type: "number" },
      { name: "garage", type: "enum" },
      { name: "amenities", type: "array" },
      { name: "hoaFee", type: "number", isOptional: true },
    ],
  },
  {
    name: "06 Education: Course Enrollment",
    schema: courseEnrollmentSchema,
    expectedFields: [
      { name: "studentId", type: "string" },
      {
        name: "firstName",
        type: "string",
        constraints: { minLength: 1, maxLength: 50 },
      },
      {
        name: "lastName",
        type: "string",
        constraints: { minLength: 1, maxLength: 50 },
      },
      {
        name: "email",
        type: "string",
        constraints: { format: "email" },
      },
      { name: "semester", type: "tuple" },
      { name: "department", type: "enum" },
      { name: "academicLevel", type: "enum" },
      { name: "courses", type: "array" },
      {
        name: "mealPlan",
        type: "enum",
        isOptional: true,
      },
      { name: "housingPreference", type: "enum" },
      { name: "preferences", type: "record" },
      { name: "financialAidApplied", type: "boolean" },
      { name: "enrollmentDate", type: "date" },
    ],
  },
  {
    name: "07 Logistics: Shipment Booking",
    schema: shipmentBookingSchema,
    expectedFields: [
      { name: "bookingReference", type: "string" },
      {
        name: "shipperName",
        type: "string",
        constraints: { minLength: 1, maxLength: 200 },
      },
      {
        name: "shipperEmail",
        type: "string",
        constraints: { format: "email" },
      },
      {
        name: "originAddress",
        type: "object",
      },
      {
        name: "destinationAddress",
        type: "object",
      },
      { name: "packages", type: "array" },
      {
        name: "shippingMethod",
        type: "union",
      },
      { name: "pickupDate", type: "date" },
      { name: "insuranceRequired", type: "boolean" },
      {
        name: "specialInstructions",
        type: "string",
        isOptional: true,
        constraints: { maxLength: 2000 },
      },
    ],
  },
  {
    name: "08 Legal: Contract Intake",
    schema: contractIntakeSchema,
    expectedFields: [
      { name: "caseNumber", type: "string" },
      {
        name: "clientFirstName",
        type: "string",
        constraints: { minLength: 1, maxLength: 50 },
      },
      {
        name: "clientLastName",
        type: "string",
        constraints: { minLength: 1, maxLength: 50 },
      },
      {
        name: "clientEmail",
        type: "string",
        constraints: { format: "email" },
      },
      {
        name: "clientPhone",
        type: "string",
        constraints: { minLength: 10, maxLength: 20 },
      },
      { name: "contractType", type: "enum" },
      { name: "effectiveDate", type: "date" },
      {
        name: "expirationDate",
        type: "date",
        isOptional: true,
      },
      { name: "contractValue", type: "number" },
      {
        name: "jurisdiction",
        type: "string",
        constraints: { minLength: 1, maxLength: 100 },
      },
      {
        name: "governingLaw",
        type: "string",
        constraints: { minLength: 1, maxLength: 100 },
      },
      {
        name: "counterpartyName",
        type: "string",
        constraints: { minLength: 1, maxLength: 200 },
      },
      {
        name: "counterpartyEmail",
        type: "string",
        isOptional: true,
        isNullable: true,
        constraints: { format: "email" },
      },
      {
        name: "contractSummary",
        type: "string",
        constraints: { minLength: 50, maxLength: 10000 },
      },
      {
        name: "specialClauses",
        type: "string",
        isOptional: true,
        isNullable: true,
        constraints: { maxLength: 5000 },
      },
      { name: "confidentialityLevel", type: "enum" },
      { name: "requiresNotarization", type: "boolean" },
      { name: "witnessRequired", type: "boolean" },
      {
        name: "previousCaseNumber",
        type: "string",
        isOptional: true,
        isNullable: true,
      },
      {
        name: "notes",
        type: "string",
        isOptional: true,
        isNullable: true,
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
        constraints: { minLength: 1, maxLength: 50 },
      },
      {
        name: "email",
        type: "string",
        constraints: { format: "email" },
      },
      {
        name: "avatarUrl",
        type: "string",
        isOptional: true,
        constraints: { format: "url" },
      },
      { name: "theme", type: "enum" },
      { name: "locale", type: "enum" },
      {
        name: "timezone",
        type: "string",
        constraints: { minLength: 1, maxLength: 50 },
      },
      { name: "dateFormat", type: "enum" },
      {
        name: "notifications",
        type: "object",
      },
      { name: "featureFlags", type: "record" },
      { name: "itemsPerPage", type: "number" },
      { name: "defaultView", type: "enum" },
      { name: "sidebarCollapsed", type: "boolean" },
      { name: "accessibilityMode", type: "boolean" },
      { name: "twoFactorEnabled", type: "boolean" },
      {
        name: "apiKeyPrefix",
        type: "string",
        isOptional: true,
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
      },
      { name: "incidentDate", type: "date" },
      { name: "dateReported", type: "date" },
      {
        name: "claimDescription",
        type: "string",
        constraints: { minLength: 20, maxLength: 5000 },
      },
      { name: "estimatedLoss", type: "number" },
      {
        name: "claimDetails",
        type: "union",
      },
      { name: "documents", type: "array" },
      { name: "hasWitnesses", type: "boolean" },
      {
        name: "witnessInfo",
        type: "string",
        isOptional: true,
        constraints: { maxLength: 2000 },
      },
      { name: "fraudAcknowledgment", type: "boolean" },
    ],
  },
  {
    name: "11 Government: Tax Filing",
    schema: taxFilingSchema,
    expectedFields: [
      { name: "taxYear", type: "number" },
      { name: "filingStatus", type: "enum" },
      {
        name: "firstName",
        type: "string",
        constraints: { minLength: 1, maxLength: 50 },
      },
      {
        name: "lastName",
        type: "string",
        constraints: { minLength: 1, maxLength: 50 },
      },
      { name: "ssn", type: "string" },
      { name: "dateOfBirth", type: "date" },
      {
        name: "phone",
        type: "string",
        constraints: { minLength: 10, maxLength: 20 },
      },
      {
        name: "email",
        type: "string",
        constraints: { format: "email" },
      },
      {
        name: "spouseFirstName",
        type: "string",
        isOptional: true,
        constraints: { minLength: 1, maxLength: 50 },
      },
      {
        name: "spouseLastName",
        type: "string",
        isOptional: true,
        constraints: { minLength: 1, maxLength: 50 },
      },
      {
        name: "spouseSsn",
        type: "string",
        isOptional: true,
      },
      {
        name: "address",
        type: "object",
      },
      { name: "claimingDependents", type: "boolean" },
      {
        name: "dependents",
        type: "array",
        isOptional: true,
      },
      { name: "incomeSources", type: "array" },
      { name: "standardDeduction", type: "boolean" },
      {
        name: "itemizedDeductions",
        type: "object",
        isOptional: true,
      },
      {
        name: "estimatedTaxPayments",
        type: "number",
        isOptional: true,
      },
      {
        name: "bankAccountForRefund",
        type: "object",
        isOptional: true,
      },
      { name: "signatureDate", type: "date" },
      { name: "electronicSignature", type: "boolean" },
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
        console.log(`  Fields: ${descriptor1.fields.map((f) => f.name).join(", ")}`);
        console.log(`  Field count: ${descriptor1.fields.length}`);
      });

      it("should introspect all expected fields with correct types", () => {
        const descriptor = introspect(
          testCase.schema as Parameters<typeof introspect>[0],
          INTROSPECT_OPTS,
        );

        expect(descriptor.fields).toHaveLength(testCase.expectedFields.length);

        for (const expected of testCase.expectedFields) {
          const actual = descriptor.fields.find((f) => f.name === expected.name);
          expect(actual, `missing field: ${expected.name}`).toBeDefined();
          expect(actual?.type, `${expected.name} type`).toBe(expected.type);

          if (expected.isOptional !== undefined) {
            expect(actual?.isOptional, `${expected.name} isOptional`).toBe(expected.isOptional);
          }
          if (expected.isNullable !== undefined) {
            expect(actual?.isNullable, `${expected.name} isNullable`).toBe(expected.isNullable);
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
    });
  }
});
