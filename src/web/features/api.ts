import { z } from "zod";
import { storage } from "@/lib/storage";
import { CreateFeatureInputSchema, FeatureSchema, type CreateFeatureInput, type Feature } from "./schema";
import { featuresListSource } from "./wireframes/features-list";
import { pageLinksSource } from "./wireframes/page-links";
import { wireFrameEditorSource } from "./wireframes/wire-frame-editor";

/** Simulated network delay of the mock API, in milliseconds. */
const DEFAULT_DELAY_MS = 400;

export const FEATURES_STORAGE_KEY = "trellis.features";

const seed = (): Feature[] => [
  {
    id: "seed-1",
    name: "Wire frame editor",
    description: "Write wire frame source and see it rendered.",
    createdAt: "2026-11-20T09:00:00.000Z",
    wireframe: wireFrameEditorSource,
  },
  {
    id: "seed-2",
    name: "Page links",
    description: "Link nodes to other pages in the preview.",
    createdAt: "2026-11-20T12:00:00.000Z",
    wireframe: pageLinksSource,
  },
  {
    id: "seed-3",
    name: "Features list",
    description: "",
    createdAt: "2026-11-21T09:00:00.000Z",
    wireframe: featuresListSource,
  },
];

let delayMs = DEFAULT_DELAY_MS;

const wait = () => (delayMs > 0 ? new Promise<void>((resolve) => setTimeout(resolve, delayMs)) : Promise.resolve());

const StoredFeaturesSchema = z.array(FeatureSchema);

function readStoredFeatures(): Feature[] | undefined {
  const raw = storage().getItem(FEATURES_STORAGE_KEY);
  if (raw === null) return undefined;
  try {
    const parsed = StoredFeaturesSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
}

function writeFeatures(features: Feature[]): void {
  storage().setItem(FEATURES_STORAGE_KEY, JSON.stringify(features));
}

/** Reads the features from local storage, first filling it with the seed when it holds nothing usable. */
function readFeatures(): Feature[] {
  const stored = readStoredFeatures();
  if (stored) return stored;
  const seeded = seed();
  writeFeatures(seeded);
  return seeded;
}

/** Sets the simulated delay (use 0 in tests). */
export function setMockDelay(ms: number): void {
  delayMs = ms;
}

export function resetMockFeatures(): void {
  storage().removeItem(FEATURES_STORAGE_KEY);
  delayMs = DEFAULT_DELAY_MS;
}

export async function listFeatures(): Promise<Feature[]> {
  await wait();
  return readFeatures();
}

export async function getFeature(id: string): Promise<Feature | undefined> {
  await wait();
  return readFeatures().find((f) => f.id === id);
}

export async function createFeature(input: CreateFeatureInput): Promise<Feature> {
  await wait();
  const parsed = CreateFeatureInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.issues.map((issue) => issue.message).join("\n"));
  }
  const feature: Feature = {
    id: crypto.randomUUID(),
    name: parsed.data.name.trim(),
    description: parsed.data.description.trim(),
    createdAt: new Date().toISOString(),
    wireframe: "",
  };
  writeFeatures([...readFeatures(), feature]);
  return { ...feature };
}

/** Saves the wire frame source of a feature; rejects with an `Error` for an unknown id. */
export async function updateFeatureWireframe(id: string, wireframe: string): Promise<Feature> {
  await wait();
  const features = readFeatures();
  const index = features.findIndex((f) => f.id === id);
  if (index === -1) throw new Error(`Feature "${id}" not found`);
  const updated: Feature = { ...features[index]!, wireframe };
  features[index] = updated;
  writeFeatures(features);
  return { ...updated };
}
