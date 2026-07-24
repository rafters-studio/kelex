import { z } from "zod/v4";

export const userSchema = z.object({
  firstName: z.string().min(1).describe("Your first name"),
  lastName: z.string().min(1),
  email: z.string().email(),
  age: z.number().min(0).max(150).optional(),
  role: z.enum(["admin", "user", "guest"]),
  newsletter: z.boolean(),
  birthDate: z.date().optional(),
  bio: z.string().max(500).optional(),
  priority: z.number().min(1).max(10),
});

export type User = z.infer<typeof userSchema>;
