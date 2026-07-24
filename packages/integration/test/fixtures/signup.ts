import { z } from "zod/v4";

export const signupSchema = z.object({
  email: z.email(),
  displayName: z.string().min(2).max(40),
  plan: z.enum(["free", "pro", "team"]),
  acceptTerms: z.boolean(),
});
