import { z } from "zod";

const NameSchema = z.string().refine((value) => value.trim().length > 0, { message: "Name is required" });

export const FeatureSchema = z.strictObject({
  id: z.string().min(1),
  name: NameSchema,
  description: z.string(),
  createdAt: z.string().min(1),
});

export const CreateFeatureInputSchema = z.strictObject({
  name: NameSchema,
  description: z.string(),
});

export type Feature = z.infer<typeof FeatureSchema>;
export type CreateFeatureInput = z.infer<typeof CreateFeatureInputSchema>;
