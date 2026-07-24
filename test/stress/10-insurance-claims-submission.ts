import { z } from "zod/v4";

/** Insurance: Claims submission
 * Tests: union of claim types (auto/home/health), nested claimant info,
 * array of documents, date fields, currency amounts, z.email()/z.url() */

const claimantInfo = z.object({
  policyNumber: z.string().regex(/^POL-\d{10}$/),
  firstName: z.string().min(1).max(50),
  lastName: z.string().min(1).max(50),
  dateOfBirth: z.date(),
  phone: z.string().min(10).max(20),
  email: z.email(),
  address: z.object({
    street: z.string().min(1).max(200),
    city: z.string().min(1).max(100),
    state: z.string().min(2).max(2),
    zip: z.string().regex(/^\d{5}$/),
  }),
});

const supportingDocument = z.object({
  documentType: z.enum([
    "photo",
    "receipt",
    "police_report",
    "medical_record",
    "estimate",
    "other",
  ]),
  description: z.string().min(1).max(500),
  fileUrl: z.url(),
  uploadedAt: z.date(),
});

const autoClaim = z.object({
  claimType: z.literal("auto"),
  vehicleVin: z.string().regex(/^[A-HJ-NPR-Z0-9]{17}$/),
  vehicleMake: z.string().min(1).max(50),
  vehicleModel: z.string().min(1).max(50),
  vehicleYear: z.int().min(1900).max(2027),
  accidentLocation: z.string().min(1).max(200),
  otherPartyInsurance: z.string().max(200).optional(),
  policeReportNumber: z.string().max(50).optional(),
});

const homeClaim = z.object({
  claimType: z.literal("home"),
  damageType: z.enum(["fire", "water", "wind", "theft", "vandalism", "other"]),
  roomsAffected: z.int().min(1).max(50),
  isHabitable: z.boolean(),
  temporaryHousingNeeded: z.boolean(),
  contractorEstimate: z.number().min(0).optional(),
});

const healthClaim = z.object({
  claimType: z.literal("health"),
  providerName: z.string().min(1).max(200),
  providerNpi: z.string().regex(/^\d{10}$/),
  diagnosisCode: z.string().regex(/^[A-Z]\d{2}(\.\d{1,4})?$/),
  procedureCode: z
    .string()
    .regex(/^\d{5}$/)
    .optional(),
  dateOfService: z.date(),
  isEmergency: z.boolean(),
  preAuthorizationNumber: z.string().max(50).optional(),
});

export const claimsSubmissionSchema = z.object({
  claimant: claimantInfo,
  incidentDate: z.date(),
  dateReported: z.date(),
  claimDescription: z
    .string()
    .min(20)
    .max(5000)
    .meta({ title: "Detailed description of the incident" }),
  estimatedLoss: z.number().min(0).multipleOf(0.01).meta({ title: "Estimated loss amount in USD" }),
  claimDetails: z.discriminatedUnion("claimType", [autoClaim, homeClaim, healthClaim]),
  documents: z.array(supportingDocument).min(1),
  hasWitnesses: z.boolean(),
  witnessInfo: z.string().max(2000).optional(),
  fraudAcknowledgment: z.boolean(),
});
