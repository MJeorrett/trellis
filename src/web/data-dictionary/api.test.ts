import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DATA_DICTIONARY_STORAGE_KEY,
  getDataDictionary,
  resetMockDataDictionary,
  saveDataDictionary,
  setMockDelay,
} from "./api";
import type { DataDictionaryRow } from "./schema";

const fakeLocalStorage = () => {
  const items = new Map<string, string>();
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
    removeItem: (key: string) => void items.delete(key),
  };
};

let local: ReturnType<typeof fakeLocalStorage>;

const rows: DataDictionaryRow[] = [
  { entity: "Customer", field: "Name", dataType: "string" },
  { entity: "Customer", field: "Age", dataType: "int" },
];

beforeEach(() => {
  local = fakeLocalStorage();
  vi.stubGlobal("localStorage", local);
  resetMockDataDictionary();
  setMockDelay(0);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("getDataDictionary", () => {
  it("starts empty and writes nothing", async () => {
    expect(await getDataDictionary()).toEqual([]);
    expect(local.getItem(DATA_DICTIONARY_STORAGE_KEY)).toBeNull();
  });

  it.each([["not json"], ['{"a":1}'], ['[{"entity":"A"}]'], ['[{"entity":"A","field":"B","dataType":"float"}]']])(
    "reads invalid stored data %j as empty",
    async (raw) => {
      local.setItem(DATA_DICTIONARY_STORAGE_KEY, raw);
      expect(await getDataDictionary()).toEqual([]);
    },
  );

  it("returns copies that do not change the store", async () => {
    await saveDataDictionary(rows);
    const first = await getDataDictionary();
    first[0]!.entity = "Changed";
    first.pop();
    expect(await getDataDictionary()).toEqual(rows);
  });
});

describe("saveDataDictionary", () => {
  it("persists the rows, and a later read returns them", async () => {
    expect(await saveDataDictionary(rows)).toEqual(rows);
    expect(JSON.parse(local.getItem(DATA_DICTIONARY_STORAGE_KEY)!)).toEqual(rows);
    expect(await getDataDictionary()).toEqual(rows);
  });

  it("saves incomplete rows", async () => {
    const incomplete: DataDictionaryRow[] = [{ entity: "", field: "bad name", dataType: "string" }];
    await saveDataDictionary(incomplete);
    expect(await getDataDictionary()).toEqual(incomplete);
  });

  it("saves an empty list", async () => {
    await saveDataDictionary(rows);
    await saveDataDictionary([]);
    expect(await getDataDictionary()).toEqual([]);
  });

  it("rejects an invalid list with an Error and writes nothing", async () => {
    await saveDataDictionary(rows);
    const before = local.getItem(DATA_DICTIONARY_STORAGE_KEY);
    const invalid = [{ entity: "A", field: "B", dataType: "float" }] as unknown as DataDictionaryRow[];
    await expect(saveDataDictionary(invalid)).rejects.toBeInstanceOf(Error);
    await expect(saveDataDictionary("nope" as unknown as DataDictionaryRow[])).rejects.toBeInstanceOf(Error);
    expect(local.getItem(DATA_DICTIONARY_STORAGE_KEY)).toBe(before);
  });
});

describe("shared data", () => {
  it("is the same list on every call, as for every feature", async () => {
    await saveDataDictionary(rows);
    expect(await getDataDictionary()).toEqual(await getDataDictionary());
    await saveDataDictionary([rows[0]!]);
    expect(await getDataDictionary()).toEqual([rows[0]]);
  });
});

describe("resetMockDataDictionary", () => {
  it("clears the stored rows", async () => {
    await saveDataDictionary(rows);
    resetMockDataDictionary();
    setMockDelay(0);
    expect(await getDataDictionary()).toEqual([]);
  });
});

describe("without a usable localStorage", () => {
  it("keeps working without persistence", async () => {
    vi.stubGlobal("localStorage", undefined);
    resetMockDataDictionary();
    setMockDelay(0);
    await saveDataDictionary(rows);
    expect(await getDataDictionary()).toEqual(rows);
    resetMockDataDictionary();
    setMockDelay(0);
    expect(await getDataDictionary()).toEqual([]);
  });
});
