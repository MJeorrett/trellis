import { CreateFeatureInputSchema, type CreateFeatureInput, type Feature } from "./schema";

export type FeatureFormValues = { name: string; description: string };

export type FeatureFormResult = { ok: true; input: CreateFeatureInput } | { ok: false; error: string };

export const emptyFeatureForm: FeatureFormValues = { name: "", description: "" };

/** Trims the form values and validates them with `CreateFeatureInputSchema`; the first error message is returned. */
export function validateFeatureForm(values: FeatureFormValues): FeatureFormResult {
  const parsed = CreateFeatureInputSchema.safeParse({
    name: values.name.trim(),
    description: values.description.trim(),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]!.message };
  }
  return { ok: true, input: parsed.data };
}

export function appendFeature(features: readonly Feature[], created: Feature): Feature[] {
  return [...features, created];
}
