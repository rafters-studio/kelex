import { z } from "zod/v4";

/** HR/Recruiting: Job application
 * Tests: array of objects (work experiences), optional nullable URL,
 * enum, long text (textarea trigger), date fields */

const workExperience = z.object({
  company: z.string().min(1).max(200),
  title: z.string().min(1).max(100),
  startDate: z.date(),
  endDate: z.date().optional(),
  isCurrent: z.boolean(),
  description: z.string().max(2000).optional(),
});

const educationEntry = z.object({
  institution: z.string().min(1).max(200),
  degree: z.enum(["high_school", "associate", "bachelor", "master", "doctorate", "other"]),
  fieldOfStudy: z.string().max(100).optional(),
  graduationYear: z.number().min(1950).max(2030),
});

export const jobApplicationSchema = z.object({
  firstName: z.string().min(1).max(50),
  lastName: z.string().min(1).max(50),
  email: z.email(),
  phone: z.string().min(10).max(20),
  linkedinUrl: z.url().nullable().optional().meta({ title: "LinkedIn profile URL" }),
  portfolioUrl: z.url().nullable().optional().meta({ title: "Portfolio website" }),
  positionApplied: z.string().min(1).max(100),
  desiredSalary: z.number().min(0).optional(),
  availableStartDate: z.date(),
  educationLevel: z.enum(["high_school", "associate", "bachelor", "master", "doctorate"]),
  education: z.array(educationEntry).min(1),
  workExperience: z.array(workExperience),
  coverLetter: z
    .string()
    .min(50)
    .max(5000)
    .meta({ title: "Cover letter -- why you want this role" }),
  skills: z.array(z.string().min(1).max(50)).min(1).max(20),
  willingToRelocate: z.boolean(),
  authorizedToWork: z.boolean(),
});
