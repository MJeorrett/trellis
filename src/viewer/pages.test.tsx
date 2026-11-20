import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Page } from "@/schema/ast";
import { PageTabs, pageLabel, resolveSelectedIndex } from "./pages";

const pages: Page[] = [
  { title: "Log in", children: [{ type: "Text", text: "Welcome back", children: [] }] },
  { title: "", children: [{ type: "Box", text: "Untitled content", children: [] }] },
  { title: "Forgot password", children: [{ type: "Text", text: "Reset it", children: [] }] },
];

const render = (selectedIndex: number, list: Page[] = pages) =>
  renderToStaticMarkup(<PageTabs pages={list} selectedIndex={selectedIndex} onSelect={() => {}} />);

/** Text content of every tab (role="tab") in the markup. */
function tabLabels(html: string): string[] {
  return [...html.matchAll(/<button[^>]*role="tab"[^>]*>(.*?)<\/button>/g)].map((m) => m[1]!);
}

describe("pageLabel", () => {
  it("uses the page title, or `Page N` (1-based) for an empty title", () => {
    expect(pageLabel(pages[0]!, 0)).toBe("Log in");
    expect(pageLabel(pages[1]!, 1)).toBe("Page 2");
    expect(pageLabel({ title: "", children: [] }, 0)).toBe("Page 1");
  });
});

describe("resolveSelectedIndex", () => {
  it("keeps the selected position when it still exists", () => {
    expect(resolveSelectedIndex(0, 3)).toBe(0);
    expect(resolveSelectedIndex(2, 3)).toBe(2);
  });

  it("falls back to the last page when the position no longer exists", () => {
    expect(resolveSelectedIndex(2, 2)).toBe(1);
    expect(resolveSelectedIndex(5, 1)).toBe(0);
  });
});

describe("PageTabs", () => {
  it("renders one tab per page, labelled by title with a `Page N` fallback", () => {
    expect(tabLabels(render(0))).toEqual(["Log in", "Page 2", "Forgot password"]);
  });

  it("shows tabs even for a single page", () => {
    expect(tabLabels(render(0, [pages[0]!]))).toEqual(["Log in"]);
  });

  it("renders only the selected page's content", () => {
    const first = render(0);
    expect(first).toContain("Welcome back");
    expect(first).not.toContain("Untitled content");
    expect(first).not.toContain("Reset it");

    const second = render(1);
    expect(second).toContain("Untitled content");
    expect(second).not.toContain("Welcome back");
    expect(second).not.toContain("Reset it");
  });

  it("falls back to the last page when the selected position no longer exists", () => {
    const html = render(7);
    expect(html).toContain("Reset it");
    expect(html).not.toContain("Welcome back");
  });

  it("renders a blank page (no children) without content", () => {
    const html = render(0, [{ title: "Blank", children: [] }]);
    expect(tabLabels(html)).toEqual(["Blank"]);
    expect(html).not.toContain("data-node-type");
  });
});
