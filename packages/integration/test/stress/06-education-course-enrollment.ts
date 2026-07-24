import { z } from "zod/v4";

/** Education: Course enrollment
 * Tests: tuple (semester), record (preferences), enum, date,
 * array of objects (courses), nested objects */

const semesterTuple = z.tuple([
  z.int().min(2020).max(2030),
  z.enum(["spring", "summer", "fall", "winter"]),
]);

const courseSelection = z.object({
  courseId: z.string().regex(/^[A-Z]{2,4}\d{3,4}$/),
  section: z.string().min(1).max(5),
  credits: z.int().min(1).max(6),
  isAudit: z.boolean(),
});

export const courseEnrollmentSchema = z.object({
  studentId: z
    .string()
    .regex(/^S\d{8}$/)
    .meta({ title: "Student ID (e.g. S12345678)" }),
  firstName: z.string().min(1).max(50),
  lastName: z.string().min(1).max(50),
  email: z.email(),
  semester: semesterTuple,
  department: z.enum([
    "cs",
    "math",
    "physics",
    "chemistry",
    "biology",
    "english",
    "history",
    "art",
    "music",
    "business",
  ]),
  academicLevel: z.enum(["freshman", "sophomore", "junior", "senior"]),
  courses: z.array(courseSelection).min(1).max(8),
  mealPlan: z.enum(["none", "basic", "standard", "premium"]).optional(),
  housingPreference: z.enum(["on_campus", "off_campus", "no_preference"]),
  preferences: z.record(z.string(), z.string()),
  financialAidApplied: z.boolean(),
  enrollmentDate: z.date(),
});
