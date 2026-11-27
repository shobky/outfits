import { z } from "zod";

export const garmentDimensionsSchema = z.object({
  width_cm: z.number().positive().max(400).nullable(),
  length_cm: z.number().positive().max(400).nullable(),
  source: z.enum(["user", "catalog"]),
}).strict().nullable();
