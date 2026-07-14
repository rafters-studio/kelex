import { z } from "zod/v4";

/** Finance: Loan application
 * Tests: discriminated union (personal vs business), nested objects,
 * regex (SSN/EIN), number constraints, .check() for cross-field validation */

const personalLoan = z.object({
  loanType: z.literal("personal"),
  ssn: z
    .string()
    .regex(/^\d{3}-\d{2}-\d{4}$/)
    .meta({ title: "Social Security Number" }),
  annualIncome: z.number().min(0).max(10_000_000),
  employmentStatus: z.enum(["employed", "self_employed", "retired", "unemployed"]),
  employer: z.string().max(200).optional(),
  yearsEmployed: z.number().min(0).max(50).optional(),
});

const businessLoan = z.object({
  loanType: z.literal("business"),
  ein: z
    .string()
    .regex(/^\d{2}-\d{7}$/)
    .meta({ title: "Employer Identification Number" }),
  businessName: z.string().min(1).max(200),
  annualRevenue: z.number().min(0),
  yearsInBusiness: z.number().min(0).max(200),
  businessType: z.enum(["sole_proprietorship", "llc", "corporation", "partnership"]),
});

export const loanApplicationSchema = z
  .object({
    applicantFirstName: z.string().min(1).max(50),
    applicantLastName: z.string().min(1).max(50),
    email: z.email(),
    phone: z.string().regex(/^\+?1?\d{10}$/),
    requestedAmount: z.number().min(1000).max(5_000_000),
    loanTerm: z.enum(["12", "24", "36", "48", "60", "84", "120"]),
    purpose: z.string().min(10).max(1000).meta({ title: "Purpose of the loan" }),
    loanDetails: z.discriminatedUnion("loanType", [personalLoan, businessLoan]),
    hasCoSigner: z.boolean(),
    agreeToTerms: z.boolean(),
  })
  .check((ctx) => {
    if (ctx.value.agreeToTerms !== true) {
      ctx.issues.push({
        code: "custom",
        message: "Must agree to terms and conditions",
        path: ["agreeToTerms"],
        input: ctx.value,
      });
    }
  });
