import { z } from "zod";
import { storage } from "@/lib/storage";
import { DataDictionaryRowSchema, type DataDictionaryRow } from "./schema";

/** Simulated network delay of the mock API, in milliseconds. */
const DEFAULT_DELAY_MS = 400;

export const DATA_DICTIONARY_STORAGE_KEY = "trellis.data-dictionary";

const DataDictionarySchema = z.array(DataDictionaryRowSchema);

let delayMs = DEFAULT_DELAY_MS;

const wait = () => (delayMs > 0 ? new Promise<void>((resolve) => setTimeout(resolve, delayMs)) : Promise.resolve());

function readRows(): DataDictionaryRow[] {
  const raw = storage().getItem(DATA_DICTIONARY_STORAGE_KEY);
  if (raw === null) return [];
  try {
    const parsed = DataDictionarySchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
}

/** Sets the simulated delay (use 0 in tests). */
export function setMockDelay(ms: number): void {
  delayMs = ms;
}

export function resetMockDataDictionary(): void {
  storage().removeItem(DATA_DICTIONARY_STORAGE_KEY);
  delayMs = DEFAULT_DELAY_MS;
}

export async function getDataDictionary(): Promise<DataDictionaryRow[]> {
  await wait();
  return readRows();
}

/** Saves the whole list; rejects with an `Error` (and writes nothing) when it is not a valid list of rows. */
export async function saveDataDictionary(rows: DataDictionaryRow[]): Promise<DataDictionaryRow[]> {
  await wait();
  const parsed = DataDictionarySchema.safeParse(rows);
  if (!parsed.success) {
    throw new Error(parsed.error.issues.map((issue) => issue.message).join("\n"));
  }
  storage().setItem(DATA_DICTIONARY_STORAGE_KEY, JSON.stringify(parsed.data));
  return parsed.data;
}
