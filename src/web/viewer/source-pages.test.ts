import { describe, expect, it } from "vitest";
import { featuresListSource } from "@/features/wireframes/features-list";
import { pageLinksSource } from "@/features/wireframes/page-links";
import { wireFrameEditorSource } from "@/features/wireframes/wire-frame-editor";
import { parseSyntax } from "@/syntax/parse";
import {
  addSourcePage,
  joinSourcePages,
  locateParseError,
  pageTabLabel,
  readPageHeader,
  splitSourcePages,
} from "./source-pages";

const two = `Page "Log in" id=login
  Box
    Text "Hi"
Page "Forgot" id=forgot
  Text "Back" link-to=login
`;

describe("splitSourcePages", () => {
  it("gives one text per Page line, in source order, each starting with its own Page line", () => {
    expect(splitSourcePages(two)).toEqual([
      'Page "Log in" id=login\n  Box\n    Text "Hi"',
      'Page "Forgot" id=forgot\n  Text "Back" link-to=login\n',
    ]);
  });

  it("gives one empty text for the empty source", () => {
    expect(splitSourcePages("")).toEqual([""]);
  });

  it("keeps text before the first Page line with the first page", () => {
    expect(splitSourcePages('Bogus\nPage "A"\n  Text "x"\nPage "B"')).toEqual([
      'Bogus\nPage "A"\n  Text "x"',
      'Page "B"',
    ]);
    expect(splitSourcePages("Bogus")).toEqual(["Bogus"]);
    expect(splitSourcePages('\nPage "A"')).toEqual(['\nPage "A"']);
  });

  it("starts a new page only at an unindented Page line", () => {
    expect(splitSourcePages('Page "A"\n  Box\n    Page "Nested"\nPage "B"')).toEqual([
      'Page "A"\n  Box\n    Page "Nested"',
      'Page "B"',
    ]);
  });

  it("starts a new page at every further Page line, even one the parser rejects", () => {
    expect(splitSourcePages('Page "A"\nPage')).toEqual(['Page "A"', "Page"]);
  });
});

describe("joinSourcePages", () => {
  it("joins the page texts by newlines, the inverse of splitSourcePages", () => {
    for (const source of [two, "", "Bogus", 'Page "A"\n', '\nPage "A"\n\nPage "B"\n\n']) {
      expect(joinSourcePages(splitSourcePages(source))).toBe(source);
    }
  });

  it("keeps what is typed stable: a trailing newline or spaces survive a round trip", () => {
    for (const text of ['Page "A"\n', 'Page "A"\n  ', 'Page "A"\n  Box\n\n    Text "x"']) {
      expect(splitSourcePages(joinSourcePages([text]))).toEqual([text]);
    }
  });

  it("turns a Page line typed in a tab into another page", () => {
    expect(splitSourcePages(joinSourcePages(['Page "A"\n  Box\nPage "B"', 'Page "C"']))).toHaveLength(3);
  });
});

describe("round trip", () => {
  const sources = {
    "Wire frame editor": wireFrameEditorSource,
    "Page links": pageLinksSource,
    "Features list": featuresListSource,
    empty: "",
  };

  for (const [name, source] of Object.entries(sources)) {
    it(`gives back the same source and AST for ${name}`, () => {
      const pages = splitSourcePages(source);
      expect(joinSourcePages(pages)).toBe(source);
      expect(parseSyntax(joinSourcePages(pages))).toEqual(parseSyntax(source));
    });
  }

  it("gives one text per page the parser finds", () => {
    for (const source of [wireFrameEditorSource, pageLinksSource, featuresListSource]) {
      const result = parseSyntax(source);
      expect(splitSourcePages(source)).toHaveLength(result.ok ? result.ast.pages.length : -1);
    }
  });
});

describe("readPageHeader", () => {
  it("reads the title and the id from the first Page line", () => {
    expect(readPageHeader('Page "Log in" id=login\n  Box')).toEqual({ title: "Log in", id: "login" });
    expect(readPageHeader('Page "A"\n  Box')).toEqual({ title: "A", id: "" });
    expect(readPageHeader('Page ""')).toEqual({ title: "", id: "" });
  });

  it("reads a title that contains a straight quote", () => {
    expect(readPageHeader('Page "a"b" id=x')).toEqual({ title: 'a"b', id: "x" });
  });

  it("reads an empty header when there is no Page line", () => {
    expect(readPageHeader("")).toEqual({ title: "", id: "" });
    expect(readPageHeader("Box")).toEqual({ title: "", id: "" });
  });

  it("keeps whatever follows Page as the title for a header it cannot read", () => {
    expect(readPageHeader("Page Log in")).toEqual({ title: "Log in", id: "" });
  });
});

describe("pageTabLabel", () => {
  it("is the page's title, so renaming the page renames its tab", () => {
    expect(pageTabLabel('Page "Log in" id=login\n  Box', 0)).toBe("Log in");
    expect(pageTabLabel('Page "Sign in" id=login\n  Box', 0)).toBe("Sign in");
  });

  it("is Page N (1-based) when the title is empty or there is no Page line", () => {
    expect(pageTabLabel('Page ""', 1)).toBe("Page 2");
    expect(pageTabLabel("", 0)).toBe("Page 1");
  });
});

describe("addSourcePage", () => {
  it("appends a page titled Page N with the id page-N for its 1-based position", () => {
    expect(addSourcePage(['Page "A" id=a', 'Page "B" id=b'])).toEqual([
      'Page "A" id=a',
      'Page "B" id=b',
      'Page "Page 3" id=page-3',
    ]);
  });

  it("uses the next free number when the id is taken", () => {
    expect(addSourcePage(['Page "A" id=a', 'Page "C" id=page-3'])).toEqual([
      'Page "A" id=a',
      'Page "C" id=page-3',
      'Page "Page 4" id=page-4',
    ]);
  });

  it("gives a source that parses with the new page last", () => {
    const result = parseSyntax(joinSourcePages(addSourcePage(splitSourcePages(two))));
    expect(result.ok && result.ast.pages.map((page) => page.id)).toEqual(["login", "forgot", "page-3"]);
  });

  it("replaces the only, blank text of a blank source rather than keeping an empty first page", () => {
    expect(addSourcePage([""])).toEqual(['Page "Page 1" id=page-1']);
    expect(addSourcePage(["\n  "])).toEqual(['Page "Page 1" id=page-1']);
    expect(addSourcePage(["Box"])).toEqual(["Box", 'Page "Page 2" id=page-2']);
  });
});

describe("locateParseError", () => {
  const errorOf = (pages: readonly string[]) => {
    const result = parseSyntax(joinSourcePages(pages));
    return result.ok ? undefined : result.error;
  };

  it("gives no location without an error", () => {
    const pages = splitSourcePages(two);
    expect(locateParseError(pages, errorOf(pages))).toBeUndefined();
  });

  it("places an error on its page with the line counted within that page, line 1 being its Page line", () => {
    const pages = ['Page "A" id=a\n  Box\n  Box', 'Page "B" id=b\n  Text "x"\n\n  Bogus'];
    expect(errorOf(pages)).toMatch(/^Line 7: /);
    expect(locateParseError(pages, errorOf(pages))).toEqual({
      page: 1,
      message: 'Line 4: Unknown type "Bogus" (expected Box or Text or Row or BoxRow or Spacer or Image)',
    });
  });

  it("places an error in the first page", () => {
    const pages = ['Page "A" id=a\n  Bogus', 'Page "B" id=b'];
    expect(locateParseError(pages, errorOf(pages))).toMatchObject({
      page: 0,
      message: expect.stringMatching(/^Line 2: Unknown type/),
    });
  });

  it("places an error on a page's own line as line 1 of that page", () => {
    const pages = ['Page "A" id=same\n  Box', 'Page "B" id=same'];
    expect(locateParseError(pages, errorOf(pages))).toEqual({ page: 1, message: 'Line 1: Duplicate page id "same"' });
  });

  it("places a nested Page where it was typed, with the parser's own message", () => {
    const pages = ['Page "A" id=a\n  Box\n    Page "X"'];
    expect(locateParseError(pages, errorOf(pages))).toEqual({ page: 0, message: "Line 3: Page cannot be nested" });
  });

  it("places an error in text before the first Page line in the first page", () => {
    const pages = splitSourcePages('Bogus\nPage "A"\nPage "B"');
    expect(locateParseError(pages, errorOf(pages))).toMatchObject({ page: 0, message: expect.stringMatching(/^Line 1: /) });
  });

  it("places an error without a line number in the first page", () => {
    expect(locateParseError(['Page "A"'], "pages.0.children: bad")).toEqual({ page: 0, message: "pages.0.children: bad" });
  });
});
