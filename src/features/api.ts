import { CreateFeatureInputSchema, type CreateFeatureInput, type Feature } from "./schema";
import { featuresListSource } from "./wireframes/features-list";
import { pageLinksSource } from "./wireframes/page-links";
import { wireFrameEditorSource } from "./wireframes/wire-frame-editor";

/** Simulated network delay of the mock API, in milliseconds. */
const DEFAULT_DELAY_MS = 400;

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

let store: Feature[] = seed();
let delayMs = DEFAULT_DELAY_MS;

const wait = () => (delayMs > 0 ? new Promise<void>((resolve) => setTimeout(resolve, delayMs)) : Promise.resolve());

/** Sets the simulated delay (use 0 in tests). */
export function setMockDelay(ms: number): void {
  delayMs = ms;
}

/** Restores the seeded features (with their wire frames) and the default delay. */
export function resetMockFeatures(): void {
  store = seed();
  delayMs = DEFAULT_DELAY_MS;
}

export async function listFeatures(): Promise<Feature[]> {
  await wait();
  return store.map((feature) => ({ ...feature }));
}

/** Resolves the feature with the given id, or `undefined` if there is none. */
export async function getFeature(id: string): Promise<Feature | undefined> {
  await wait();
  const feature = store.find((f) => f.id === id);
  return feature ? { ...feature } : undefined;
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
  store.push(feature);
  return { ...feature };
}

/** Saves the wire frame source of a feature; rejects with an `Error` for an unknown id. */
export async function updateFeatureWireframe(id: string, wireframe: string): Promise<Feature> {
  await wait();
  const index = store.findIndex((f) => f.id === id);
  if (index === -1) throw new Error(`Feature "${id}" not found`);
  const updated: Feature = { ...store[index]!, wireframe };
  store[index] = updated;
  return { ...updated };
}
