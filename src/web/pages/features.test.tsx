import { renderToStaticMarkup } from "react-dom/server";
import type { ReactElement } from "react";
import { MemoryRouter, Navigate, matchRoutes } from "react-router";
import { describe, expect, it } from "vitest";
import App, { appRoutes } from "@/App";
import type { DataDictionaryRow } from "@/data-dictionary/schema";
import { FeatureList } from "@/features/feature-list";
import type { Feature } from "@/features/schema";
import FeaturesPage from "./features";
import { FeatureDetailsView, FeatureNotFound } from "./feature-details";

const features: Feature[] = [
  { id: "1", name: "Search", description: "Find things", createdAt: "2026-11-21T10:00:00.000Z", wireframe: "" },
  { id: "2", name: "Export", description: "", createdAt: "2026-11-21T11:00:00.000Z", wireframe: "" },
];

const inRouter = (element: ReactElement, path = "/features") =>
  renderToStaticMarkup(<MemoryRouter initialEntries={[path]}>{element}</MemoryRouter>);

describe("FeatureList", () => {
  it("renders names and descriptions in order", () => {
    const html = inRouter(<FeatureList features={features} />);
    expect(html).toContain("Search");
    expect(html).toContain("Find things");
    expect(html).toContain("Export");
    expect(html.indexOf("Search")).toBeLessThan(html.indexOf("Export"));
  });

  it("links each name to /features/<id>", () => {
    const html = inRouter(<FeatureList features={features} />);
    const links = [...html.matchAll(/<a [^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/g)].map((m) => ({
      href: m[1],
      label: m[2],
    }));
    expect(links).toEqual([
      { href: "/features/1", label: "Search" },
      { href: "/features/2", label: "Export" },
    ]);
  });

  it("renders no description element for an empty description", () => {
    const html = inRouter(<FeatureList features={[features[1]!]} />);
    expect(html.match(/<p /g)).toHaveLength(1);
  });

  it("renders nothing but the list container when there are no features", () => {
    expect(inRouter(<FeatureList features={[]} />)).not.toContain("<li");
  });
});

describe("FeaturesPage", () => {
  it("renders the title and the Create feature button", () => {
    const html = inRouter(<FeaturesPage />);
    expect(html).toContain("Features");
    expect(html).toMatch(/<button[^>]*>Create feature<\/button>/);
  });
});

describe("FeatureDetailsView", () => {
  const feature: Feature = {
    id: "1",
    name: "Search",
    description: "Find things",
    createdAt: "2026-11-21T10:00:00.000Z",
    wireframe: 'Page "Home"\n  Text "Hello"\n',
  };
  const render = (f: Feature) => inRouter(<FeatureDetailsView feature={f} onSourceChange={() => {}} />, "/features/1");

  it("shows the name as the heading, the description and a link back to /features", () => {
    const html = render(feature);
    expect(html).toMatch(/<h1[^>]*>Feature: (<!-- -->)?Search<\/h1>/);
    expect(html).toMatch(/<h2[^>]*>Wireframe<\/h2>/);
    expect(html).not.toContain("max-w-6xl");
    expect(html).toContain("Find things");
    expect(html).toMatch(/<a [^>]*href="\/features"/);
  });

  it("omits the description when it is empty", () => {
    expect(render({ ...feature, description: "" }).match(/<p /g)).toBeNull();
  });

  it("renders the WireframeEditor: the source editor with the feature's source and the preview", () => {
    const html = render(feature);
    expect(html).toContain("Wire frame source");
    expect(html).toContain("Hello");
    expect(html).toContain("Home");
    expect(html).toContain('aria-label="Pages"');
  });

  it("shows a parse error inline while still showing the source", () => {
    const html = render({ ...feature, wireframe: "Bogus" });
    expect(html).toContain('role="alert"');
    expect(html).toContain("Fix the source to see the wire frame.");
  });

  it("renders the blank page (Page 1) for a blank wire frame", () => {
    expect(render({ ...feature, wireframe: "" })).toContain("Page 1");
  });

  describe("data dictionary", () => {
    const renderWithRows = (rows?: DataDictionaryRow[]) =>
      inRouter(
        <FeatureDetailsView
          feature={feature}
          onSourceChange={() => {}}
          dataDictionary={rows}
          onDataDictionaryChange={() => {}}
        />,
        "/features/1",
      );

    it("shows the pane below the wire frame with the rows", () => {
      const html = renderWithRows([{ entity: "Customer", field: "Name", dataType: "string" }]);
      expect(html).toContain("Data dictionary");
      expect(html).toContain('value="Customer"');
      expect(html.indexOf("Wireframe")).toBeLessThan(html.indexOf("Data dictionary"));
      expect(html.indexOf("Wire frame source")).toBeLessThan(html.indexOf("Data dictionary"));
      expect(html.indexOf("Hello")).toBeLessThan(html.indexOf("Data dictionary"));
    });

    it("shows the pane with no rows once loaded, and nothing before", () => {
      expect(renderWithRows([])).toContain("No fields yet");
      expect(render(feature)).not.toContain("Data dictionary");
      expect(renderWithRows(undefined)).not.toContain("Data dictionary");
    });

    it("is not shown on the feature not found page", () => {
      expect(inRouter(<FeatureNotFound />, "/features/nope")).not.toContain("Data dictionary");
    });
  });

  describe("static layout", () => {
    const html = render(feature);
    const withPane = inRouter(
      <FeatureDetailsView feature={feature} onSourceChange={() => {}} dataDictionary={[]} />,
      "/features/1",
    );

    it("fills its area without a page scroll bar", () => {
      expect(html).toMatch(/<main class="[^"]*\bh-full\b[^"]*\bmin-h-0\b[^"]*\boverflow-hidden\b/);
    });

    it("keeps the header and the Wireframe heading at their natural height", () => {
      expect(html).toMatch(/<div class="[^"]*\bflex-none\b[^"]*"><a /);
      expect(html).toMatch(/<h2 class="[^"]*\bflex-none\b[^"]*">Wireframe<\/h2>/);
    });

    it("gives the editor the flexible height between the heading and the pane", () => {
      expect(html).toMatch(/<div class="min-h-0 flex-1"><div class="[^"]*\bh-full\b/);
    });

    it("keeps the data dictionary pane at its fixed height", () => {
      expect(withPane).toMatch(/<section class="[^"]*\bflex-none\b[^"]*"><div class="[^"]*"><h2[^>]*>Data dictionary/);
    });

    it("scrolls the content of the wire frame cards", () => {
      expect(html.match(/data-slot="card-content" class="[^"]*\bmin-h-0\b[^"]*\bflex-1\b[^"]*\boverflow-y-auto\b/g)).toHaveLength(2);
    });
  });
});

describe("FeatureNotFound", () => {
  it("shows the message and a link back to /features", () => {
    const html = inRouter(<FeatureNotFound />, "/features/nope");
    expect(html).toContain("Feature not found");
    expect(html).toMatch(/<a [^>]*href="\/features"/);
  });
});

describe("routing", () => {
  const renderAt = (path: string) =>
    renderToStaticMarkup(
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>,
    );

  it("renders the features page at /features", () => {
    const html = renderAt("/features");
    expect(html).toContain("Create feature");
    expect(html).not.toContain("Wire frame source");
  });

  // A static render does not run effects, so the details page shows nothing until the mock API has answered;
  // here only the route is matched and the page must not show the features list page.
  it("routes /features/:id to the details page, not the features page", () => {
    const html = renderAt("/features/seed-1");
    expect(html).not.toContain("Create feature");
    const matches = matchRoutes(appRoutes, "/features/seed-1");
    expect(matches!.at(-1)!.route.path).toBe("/features/:id");
    expect(matches!.at(-1)!.params).toEqual({ id: "seed-1" });
  });

  it("fills the window with the nav above a scrolling routed area", () => {
    const html = renderAt("/features");
    expect(html).toMatch(/<div class="flex h-dvh flex-col"><header/);
    expect(html).toMatch(/<div class="min-h-0 flex-1 overflow-auto"><main/);
  });

  it("shows the top nav with only Features, marked current on /features and /features/:id", () => {
    const navLinks = (html: string) =>
      [...html.matchAll(/<a ([^>]*)>(.*?)<\/a>/g)].map((m) => ({
        label: m[2]!,
        href: /href="([^"]*)"/.exec(m[1]!)![1],
        current: m[1]!.includes('aria-current="page"'),
      }));

    const expected = [{ label: "Features", href: "/features", current: true }];
    expect(navLinks(renderAt("/features"))).toEqual(expected);
    expect(navLinks(renderAt("/features/seed-1"))).toEqual(expected);
  });

  // A static render does not run effects, so a `Navigate` cannot be followed there; instead the route table is
  // matched and the matched route must be a `Navigate` to /features, which then renders as tested above.
  it("redirects /, /wireframe-demo and unknown paths to the features page", () => {
    for (const path of ["/", "/wireframe-demo", "/nope", "/features/a/b", "/wireframe-demo/extra"]) {
      const matches = matchRoutes(appRoutes, path);
      const element = matches!.at(-1)!.route.element as ReactElement<{ to: string; replace?: boolean }>;
      expect(element.type).toBe(Navigate);
      expect(element.props.to).toBe("/features");
    }
  });
});
