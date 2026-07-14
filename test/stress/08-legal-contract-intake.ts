import { z } from "zod/v4";

/** Legal: Contract intake
 * Tests: very long string fields (textarea), regex-validated case numbers,
 * deeply optional chains (nullish), branded types (transparent in v4),
 * number coercion via pipe, z.email() top-level format */

const CaseNumber = z
  .string()
  .regex(/^\d{4}-[A-Z]{2}-\d{6}$/)
  .brand("CaseNumber");

export const contractIntakeSchema = z.object({
  caseNumber: CaseNumber.meta({ title: "Case number (e.g. 2024-CV-000123)" }),
  clientFirstName: z.string().min(1).max(50),
  clientLastName: z.string().min(1).max(50),
  clientEmail: z.email(),
  clientPhone: z.string().min(10).max(20),
  contractType: z.enum([
    "employment",
    "nda",
    "service_agreement",
    "lease",
    "purchase",
    "licensing",
    "partnership",
  ]),
  effectiveDate: z.date(),
  expirationDate: z.date().optional(),
  contractValue: z.number().min(0).meta({ title: "Total contract value in USD" }),
  jurisdiction: z.string().min(1).max(100),
  governingLaw: z.string().min(1).max(100).meta({ title: "Governing law state/jurisdiction" }),
  counterpartyName: z.string().min(1).max(200),
  counterpartyEmail: z.email().nullish(),
  contractSummary: z
    .string()
    .min(50)
    .max(10000)
    .meta({ title: "Detailed summary of contract terms and conditions" }),
  specialClauses: z
    .string()
    .max(5000)
    .nullish()
    .meta({ title: "Any special clauses or non-standard terms" }),
  confidentialityLevel: z.enum(["public", "internal", "confidential", "restricted"]),
  requiresNotarization: z.boolean(),
  witnessRequired: z.boolean(),
  previousCaseNumber: z
    .string()
    .regex(/^\d{4}-[A-Z]{2}-\d{6}$/)
    .nullish()
    .meta({ title: "Related previous case number if any" }),
  notes: z.string().max(5000).nullish().meta({ title: "Internal notes for the legal team" }),
});
