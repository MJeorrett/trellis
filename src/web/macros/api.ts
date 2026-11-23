import { z } from "zod";
import { storage } from "@/lib/storage";

/** Simulated network delay of the mock API, in milliseconds. */
const DEFAULT_DELAY_MS = 400;

export const MACROS_STORAGE_KEY = "trellis.macros";

const MacrosSourceSchema = z.string();

/**
 * What the Macros page starts with until something is saved: the `Field` and `PageTitle` macros and a page that
 * uses them.
 */
export const seedMacrosSource = `Def Field $for=label|mockValue
  Text "$for.label"
  Box "$for.mockValue"

Def PageTitle
  Text "$1" font=bold font-size=lg

Page "Examples"
  PageTitle "My Page"
  Field for="Email"|"you@example.com"
  Field for="Password"|"*********"
`;

let delayMs = DEFAULT_DELAY_MS;

const wait = () => (delayMs > 0 ? new Promise<void>((resolve) => setTimeout(resolve, delayMs)) : Promise.resolve());

/** Sets the simulated delay (use 0 in tests). */
export function setMockDelay(ms: number): void {
  delayMs = ms;
}

export function resetMockMacros(): void {
  storage().removeItem(MACROS_STORAGE_KEY);
  delayMs = DEFAULT_DELAY_MS;
}

/** The global macros source: the saved text, or the seed when nothing has been saved. */
export async function getMacros(): Promise<string> {
  await wait();
  return storage().getItem(MACROS_STORAGE_KEY) ?? seedMacrosSource;
}

/** Saves the whole source (any text, so a macro can be incomplete while it is being typed). */
export async function saveMacros(source: string): Promise<string> {
  await wait();
  const parsed = MacrosSourceSchema.safeParse(source);
  if (!parsed.success) throw new Error(parsed.error.issues.map((issue) => issue.message).join("\n"));
  storage().setItem(MACROS_STORAGE_KEY, parsed.data);
  return parsed.data;
}
