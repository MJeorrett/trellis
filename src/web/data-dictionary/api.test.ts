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
  { entity: "Customer", field: "Name", dataType: "string", label: "Customer name", mockValues: "Ada" },
  { entity: "Customer", field: "Age", dataType: "int", label: "", mockValues: "42" },
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

  it("reads rows stored before label and mockValues existed with empty strings", async () => {
    local.setItem(
      DATA_DICTIONARY_STORAGE_KEY,
      JSON.stringify([
        { entity: "Customer", field: "Name", dataType: "string" },
        { entity: "Order", field: "Placed", dataType: "datetime" },
      ]),
    );
    expect(await getDataDictionary()).toEqual([
      { entity: "Customer", field: "Name", dataType: "string", label: "", mockValues: "" },
      { entity: "Order", field: "Placed", dataType: "datetime", label: "", mockValues: "" },
    ]);
  });

  it("reads rows saved with the old mockValue key as mockValues", async () => {
    local.setItem(
      DATA_DICTIONARY_STORAGE_KEY,
      JSON.stringify([{ entity: "Customer", field: "Name", dataType: "string", label: "Name", mockValue: "Ada" }]),
    );
    expect(await getDataDictionary()).toEqual([
      { entity: "Customer", field: "Name", dataType: "string", label: "Name", mockValues: "Ada" },
    ]);
  });

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

  it("saves label and mockValues, and a later read returns them", async () => {
    await saveDataDictionary(rows);
    expect(JSON.parse(local.getItem(DATA_DICTIONARY_STORAGE_KEY)!)[0]).toMatchObject({
      label: "Customer name",
      mockValues: "Ada",
    });
    const read = await getDataDictionary();
    expect(read[0]!.label).toBe("Customer name");
    expect(read[0]!.mockValues).toBe("Ada");
    expect(read[1]!.mockValues).toBe("42");
  });

  it("saves incomplete rows", async () => {
    const incomplete: DataDictionaryRow[] = [{ entity: "", field: "bad name", dataType: "string", label: "", mockValues: "" }];
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
