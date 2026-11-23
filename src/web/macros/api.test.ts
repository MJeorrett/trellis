import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { compileSyntax } from "@/syntax/compile";
import { featuresListSource } from "@/features/wireframes/features-list";
import { pageLinksSource } from "@/features/wireframes/page-links";
import { wireFrameEditorSource } from "@/features/wireframes/wire-frame-editor";
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

  it("has a seed that defines Field, PageTitle and List, with an Examples page using them", () => {
    expect(seedMacrosSource).toContain("Def Field $for=label|mockValues");
    expect(seedMacrosSource).toContain("Def PageTitle\n");
    expect(seedMacrosSource).toContain('Def List $items\n  Box\n    Each $items as=item\n      Text "$item"\n');
    expect(seedMacrosSource).toContain('Page "Examples"');
    expect(seedMacrosSource).toMatch(/^ {2}PageTitle "My Page"$/m);
    expect(seedMacrosSource).toMatch(/^ {2}Field for="Email"\|"you@example\.com"$/m);
    expect(seedMacrosSource).toMatch(/^ {2}Field for="Password"\|"\*+"$/m);
    expect(seedMacrosSource).toMatch(/^ {2}List items="Reports","Settings","Help"$/m);
  });

  it("has no seeded feature wire frame that defines a macro, so List is not a duplicate", () => {
    for (const source of [featuresListSource, wireFrameEditorSource, pageLinksSource]) {
      expect(source).not.toMatch(/^Def /m);
    }
  });

  it("has a seed that is the same wire frame as writing it by hand", () => {
    const byHand = parseSyntax(
      [
        'Page "Examples"',
        '  Text "My Page" font=bold font-size=lg',
        '  Text "Email"',
        '  Box "you@example.com"',
        '  Text "Password"',
        '  Box "*********"',
        "  Box",
        '    Text "Reports"',
        '    Text "Settings"',
        '    Text "Help"',
        "",
      ].join("\n"),
    );
    expect(compileSyntax(seedMacrosSource)).toEqual(byHand);
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
