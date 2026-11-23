import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { compileSyntax } from "@/syntax/compile";
import { parseSyntax } from "@/syntax/parse";
import { getMacros, MACROS_STORAGE_KEY, resetMockMacros, saveMacros, seedMacrosSource, setMockDelay } from "./api";

const fakeLocalStorage = () => {
  const items = new Map<string, string>();
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
    removeItem: (key: string) => void items.delete(key),
  };
};

let local: ReturnType<typeof fakeLocalStorage>;

beforeEach(() => {
  local = fakeLocalStorage();
  vi.stubGlobal("localStorage", local);
  resetMockMacros();
  setMockDelay(0);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("getMacros", () => {
  it("starts with the seed and writes nothing", async () => {
    expect(await getMacros()).toBe(seedMacrosSource);
    expect(local.getItem(MACROS_STORAGE_KEY)).toBeNull();
  });

  it("has a seed that compiles", () => {
    expect(compileSyntax(seedMacrosSource).ok).toBe(true);
  });

  it("has a seed that defines Field and Card, with a Try it page using Field and a card in each argument form", () => {
    expect(seedMacrosSource).toContain("Def Field $label $value");
    expect(seedMacrosSource).toContain("Def Card $item=title|description|id");
    expect(seedMacrosSource).toMatch(/^ {2}Card item\.title="[^"]*" item\.description="[^"]*" item\.id="[^"]*"$/m);
    expect(seedMacrosSource).toMatch(/^ {2}Card item="[^"]*"\|"[^"]*"\|"[^"]*"$/m);
    expect(seedMacrosSource).toMatch(/^ {2}Field label=/m);
  });

  it("has a seed whose two cards are the same wire frame as writing them by hand", () => {
    const cardByHand = (title: string, description: string, id: string) => {
      const result = parseSyntax(
        `Page "Try it"\n  Box\n    Text "${title}" font=bold\n    Text "${description}"\n    Text "${id}"\n`,
      );
      return result.ok ? result.ast.pages[0]!.children[0] : undefined;
    };
    const seed = compileSyntax(seedMacrosSource);
    if (!seed.ok) throw new Error(seed.error);
    const children = seed.ast.pages[0]!.children;
    expect(children).toHaveLength(4);
    expect(children[2]).toEqual(cardByHand("Welcome", "Say hello to the team", "1"));
    expect(children[3]).toEqual(cardByHand("Reports", "See how the team is doing", "2"));
  });
});

describe("saveMacros", () => {
  it("persists the text as it is, and a later read returns it", async () => {
    const source = "Def A $x\n  Text \"$x\"\n";
    expect(await saveMacros(source)).toBe(source);
    expect(local.getItem(MACROS_STORAGE_KEY)).toBe(source);
    expect(await getMacros()).toBe(source);
  });

  it("saves an incomplete source and the empty text (which is not the seed)", async () => {
    await saveMacros("Def a");
    expect(await getMacros()).toBe("Def a");
    await saveMacros("");
    expect(await getMacros()).toBe("");
  });

  it("rejects a value that is not text and writes nothing", async () => {
    await expect(saveMacros(1 as unknown as string)).rejects.toBeInstanceOf(Error);
    expect(local.getItem(MACROS_STORAGE_KEY)).toBeNull();
  });
});

describe("resetMockMacros", () => {
  it("restores the seed", async () => {
    await saveMacros("x");
    resetMockMacros();
    setMockDelay(0);
    expect(await getMacros()).toBe(seedMacrosSource);
  });
});

describe("without a usable localStorage", () => {
  it("keeps working without persistence", async () => {
    vi.stubGlobal("localStorage", undefined);
    resetMockMacros();
    setMockDelay(0);
    await saveMacros("kept");
    expect(await getMacros()).toBe("kept");
    resetMockMacros();
    setMockDelay(0);
    expect(await getMacros()).toBe(seedMacrosSource);
  });
});
