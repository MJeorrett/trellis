export type MockStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const memoryStorage = (): MockStorage => {
  const items = new Map<string, string>();
  return {
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => void items.set(key, value),
    removeItem: (key) => void items.delete(key),
  };
};

// Environments without a usable localStorage (non-browser runtimes, blocked storage) still get a working mock API.
const fallbackStorage = memoryStorage();

export function storage(): MockStorage {
  try {
    return globalThis.localStorage ?? fallbackStorage;
  } catch {
    return fallbackStorage;
  }
}
