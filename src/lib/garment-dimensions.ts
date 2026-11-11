import { z } from "zod";

export const garmentDimensionsSchema = z.object({
  width_cm: z.number().positive().max(400).nullable(),
  length_cm: z.number().positive().max(400).nullable(),
  source: z.literal("user"),
}).strict().nullable();
