import { z } from "zod";
import { DataDictionaryRowSchema } from "@/data-dictionary/schema";

export const SharedWireframeSchema = z.strictObject({
  v: z.literal(1),
  name: z.string(),
  wireframe: z.string(),
  macros: z.string(),
  dataDictionary: z.array(DataDictionaryRowSchema),
});

export type SharedWireframe = z.infer<typeof SharedWireframeSchema>;
