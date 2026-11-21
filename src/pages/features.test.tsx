import { renderToStaticMarkup } from "react-dom/server";
import type { ReactElement } from "react";
import { MemoryRouter, Navigate, matchRoutes } from "react-router";
import { describe, expect, it } from "vitest";
import App, { appRoutes } from "@/App";
import { FeatureList } from "@/features/feature-list";
import type { Feature } from "@/features/schema";
import FeaturesPage from "./features";

const features: Feature[] = [
  { id: "1", name: "Search", description: "Find things", createdAt: "2026-11-21T10:00:00.000Z" },
  { id: "2", name: "Export", description: "", createdAt: "2026-11-21T11:00:00.000Z" },
];

describe("FeatureList", () => {
  it("renders names and descriptions in order", () => {
    const html = renderToStaticMarkup(<FeatureList features={features} />);
    expect(html).toContain("Search");
    expect(html).toContain("Find things");
    expect(html).toContain("Export");
    expect(html.indexOf("Search")).toBeLessThan(html.indexOf("Export"));
  });

  it("renders no description element for an empty description", () => {
    const html = renderToStaticMarkup(<FeatureList features={[features[1]!]} />);
    expect(html.match(/<p /g)).toHaveLength(1);
  });

  it("renders nothing but the list container when there are no features", () => {
    expect(renderToStaticMarkup(<FeatureList features={[]} />)).not.toContain("<li");
  });
});

describe("FeaturesPage", () => {
  it("renders the title and the Create feature button", () => {
    const html = renderToStaticMarkup(<FeaturesPage />);
    expect(html).toContain("Features");
    expect(html).toMatch(/<button[^>]*>Create feature<\/button>/);
  });
});

describe("routing", () => {
  const renderAt = (path: string) =>
    renderToStaticMarkup(
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>,
    );

  it("renders the features page at /features, without the wire frame demo", () => {
    const html = renderAt("/features");
    expect(html).toContain("Create feature");
    expect(html).not.toContain("Wire frame source");
  });

  it("renders the wire frame demo at /wireframe-demo, without the features page", () => {
    const html = renderAt("/wireframe-demo");
    expect(html).toContain("Wire frame source");
    expect(html).not.toContain("Create feature");
  });

  it("shows the top nav on every page, marking the current page", () => {
    const navLinks = (html: string) =>
      [...html.matchAll(/<a ([^>]*)>(.*?)<\/a>/g)].map((m) => ({
        label: m[2]!,
        href: /href="([^"]*)"/.exec(m[1]!)![1],
        current: m[1]!.includes('aria-current="page"'),
      }));

    expect(navLinks(renderAt("/features"))).toEqual([
      { label: "Features", href: "/features", current: true },
      { label: "Wireframe", href: "/wireframe-demo", current: false },
    ]);
    expect(navLinks(renderAt("/wireframe-demo"))).toEqual([
      { label: "Features", href: "/features", current: false },
      { label: "Wireframe", href: "/wireframe-demo", current: true },
    ]);
  });

  // A static render does not run effects, so a `Navigate` cannot be followed there; instead the route table is
  // matched and the matched route must be a `Navigate` to /features, which then renders as tested above.
  it("redirects / and unknown paths to the features page", () => {
    for (const path of ["/", "/nope", "/features/extra", "/wireframe-demo/extra"]) {
      const matches = matchRoutes(appRoutes, path);
      const element = matches!.at(-1)!.route.element as ReactElement<{ to: string; replace?: boolean }>;
      expect(element.type).toBe(Navigate);
      expect(element.props.to).toBe("/features");
    }
  });
});
