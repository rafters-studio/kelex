import { z } from "zod/v4";

/** Government/Tax: Tax filing form
 * Tests: .check() for cross-field conditional logic, discriminated union
 * for income source, conditional required fields, array of dependents */

const dependent = z.object({
  firstName: z.string().min(1).max(50),
  lastName: z.string().min(1).max(50),
  ssn: z.string().regex(/^\d{3}-\d{2}-\d{4}$/),
  relationship: z.enum(["child", "stepchild", "foster_child", "sibling", "parent", "other"]),
  dateOfBirth: z.date(),
  monthsLivedWithYou: z.int().min(0).max(12),
});

const w2Income = z.object({
  sourceType: z.literal("w2"),
  employerEin: z.string().regex(/^\d{2}-\d{7}$/),
  employerName: z.string().min(1).max(200),
  wages: z.number().min(0),
  federalTaxWithheld: z.number().min(0),
  stateTaxWithheld: z.number().min(0).optional(),
});

const selfEmploymentIncome = z.object({
  sourceType: z.literal("self_employed"),
  businessName: z.string().min(1).max(200),
  businessEin: z
    .string()
    .regex(/^\d{2}-\d{7}$/)
    .optional(),
  grossIncome: z.number().min(0),
  expenses: z.number().min(0),
  homeOfficeDeduction: z.number().min(0).optional(),
  vehicleDeduction: z.number().min(0).optional(),
});

const investmentIncome = z.object({
  sourceType: z.literal("investment"),
  brokerageName: z.string().min(1).max(200),
  dividends: z.number().min(0),
  capitalGains: z.number(),
  capitalLosses: z.number().min(0),
  interestIncome: z.number().min(0),
});

export const taxFilingSchema = z
  .object({
    taxYear: z.int().min(2020).max(2026),
    filingStatus: z.enum([
      "single",
      "married_joint",
      "married_separate",
      "head_of_household",
      "qualifying_widow",
    ]),
    firstName: z.string().min(1).max(50),
    lastName: z.string().min(1).max(50),
    ssn: z.string().regex(/^\d{3}-\d{2}-\d{4}$/),
    dateOfBirth: z.date(),
    phone: z.string().min(10).max(20),
    email: z.email(),
    spouseFirstName: z.string().min(1).max(50).optional(),
    spouseLastName: z.string().min(1).max(50).optional(),
    spouseSsn: z
      .string()
      .regex(/^\d{3}-\d{2}-\d{4}$/)
      .optional(),
    address: z.object({
      street: z.string().min(1).max(200),
      city: z.string().min(1).max(100),
      state: z.string().min(2).max(2),
      zip: z.string().regex(/^\d{5}$/),
    }),
    claimingDependents: z.boolean(),
    dependents: z.array(dependent).optional(),
    incomeSources: z.array(
      z.discriminatedUnion("sourceType", [w2Income, selfEmploymentIncome, investmentIncome]),
    ),
    standardDeduction: z.boolean(),
    itemizedDeductions: z
      .object({
        medicalExpenses: z.number().min(0),
        stateLocalTaxes: z.number().min(0).max(10000),
        mortgageInterest: z.number().min(0),
        charitableContributions: z.number().min(0),
        otherDeductions: z.number().min(0),
      })
      .optional(),
    estimatedTaxPayments: z.number().min(0).optional(),
    bankAccountForRefund: z
      .object({
        routingNumber: z.string().regex(/^\d{9}$/),
        accountNumber: z.string().min(4).max(17),
        accountType: z.enum(["checking", "savings"]),
      })
      .optional(),
    signatureDate: z.date(),
    electronicSignature: z.boolean(),
  })
  .check((ctx) => {
    const data = ctx.value;

    if (data.filingStatus === "married_joint") {
      if (!data.spouseFirstName) {
        ctx.issues.push({
          code: "custom",
          message: "Spouse first name required for joint filing",
          path: ["spouseFirstName"],
          input: data,
        });
      }
      if (!data.spouseSsn) {
        ctx.issues.push({
          code: "custom",
          message: "Spouse SSN required for joint filing",
          path: ["spouseSsn"],
          input: data,
        });
      }
    }

    if (data.claimingDependents && (!data.dependents || data.dependents.length === 0)) {
      ctx.issues.push({
        code: "custom",
        message: "Must list at least one dependent when claiming dependents",
        path: ["dependents"],
        input: data,
      });
    }

    if (!data.standardDeduction && !data.itemizedDeductions) {
      ctx.issues.push({
        code: "custom",
        message: "Must provide itemized deductions if not taking standard deduction",
        path: ["itemizedDeductions"],
        input: data,
      });
    }
  });
