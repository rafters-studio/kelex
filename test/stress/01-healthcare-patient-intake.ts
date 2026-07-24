import { z } from "zod/v4";

/** Healthcare: Patient intake form
 * Tests: nested object (address), date, enum, optional fields, regex (phone) */

const addressSchema = z.object({
  street: z.string().min(1).max(200),
  city: z.string().min(1).max(100),
  state: z.string().min(2).max(2),
  zip: z.string().regex(/^\d{5}(-\d{4})?$/),
});

export const patientIntakeSchema = z.object({
  firstName: z.string().min(1).max(50).meta({ title: "Patient first name" }),
  lastName: z.string().min(1).max(50).meta({ title: "Patient last name" }),
  dateOfBirth: z.date().meta({ title: "Date of birth" }),
  phone: z
    .string()
    .regex(/^\(\d{3}\) \d{3}-\d{4}$/)
    .meta({ title: "Phone number" }),
  email: z.email().optional().meta({ title: "Email address" }),
  address: addressSchema.meta({ title: "Mailing address" }),
  insuranceType: z.enum(["private", "medicare", "medicaid", "uninsured"]),
  allergies: z.string().max(500).optional().meta({ title: "Known allergies" }),
  emergencyContactName: z.string().min(1).max(100).optional(),
  emergencyContactPhone: z
    .string()
    .regex(/^\(\d{3}\) \d{3}-\d{4}$/)
    .optional(),
});
