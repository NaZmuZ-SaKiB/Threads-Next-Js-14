import { z } from "zod";

export const ThreadValidation = z.object({
  thread: z
    .string()
    .min(3, { message: "Thread must be at least 3 characters long" }),
  communityId: z.string().optional(),
});
