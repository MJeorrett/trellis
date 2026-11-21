import { CreateFeatureInputSchema, type CreateFeatureInput, type Feature } from "./schema";

/** Simulated network delay of the mock API, in milliseconds. */
const DEFAULT_DELAY_MS = 400;

const seed = (): Feature[] => [
  {
    id: "seed-1",
    name: "Wire frame editor",
    description: "Write wire frame source and see it rendered.",
    createdAt: "2026-11-20T09:00:00.000Z",
  },
  {
    id: "seed-2",
    name: "Page links",
    description: "Link nodes to other pages in the preview.",
    createdAt: "2026-11-20T12:00:00.000Z",
  },
  {
    id: "seed-3",
    name: "Features list",
    description: "",
    createdAt: "2026-11-21T09:00:00.000Z",
  },
];

let store: Feature[] = seed();
let delayMs = DEFAULT_DELAY_MS;

const wait = () => (delayMs > 0 ? new Promise<void>((resolve) => setTimeout(resolve, delayMs)) : Promise.resolve());

/** Sets the simulated delay (use 0 in tests). */
export function setMockDelay(ms: number): void {
  delayMs = ms;
}

/** Restores the seeded features and the default delay. */
export function resetMockFeatures(): void {
  store = seed();
  delayMs = DEFAULT_DELAY_MS;
}

export async function listFeatures(): Promise<Feature[]> {
  await wait();
  return store.map((feature) => ({ ...feature }));
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
  };
  store.push(feature);
  return { ...feature };
}
