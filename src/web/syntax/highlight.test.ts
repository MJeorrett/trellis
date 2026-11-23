import { describe, expect, it } from "vitest";
import { tokenizeLine, trellisHighlighter, trellisLanguage } from "./highlight";

/** The highlighted pieces of a line as `[token, text]`, leaving out the plain text between them. */
const marked = (line: string) =>
  tokenizeLine(line)
    .filter((piece) => piece.token !== null)
    .map((piece) => [piece.token, piece.text]);

describe("tokenizeLine comments", () => {
  it("makes a whole line starting with # one comment", () => {
    expect(tokenizeLine("# note")).toEqual([{ text: "# note", token: "comment" }]);
  });

  it("makes # alone a comment", () => {
    expect(tokenizeLine("#")).toEqual([{ text: "#", token: "comment" }]);
  });

  it("does not make an indented # or a # in text a comment", () => {
    expect(marked("  # note")).toEqual([]);
    expect(marked('Box "# x"')).toEqual([
      ["typeName", "Box"],
      ["string", '"# x"'],
    ]);
  });
});

describe("tokenizeLine nodes", () => {
  it("finds the type, the string and the attribute of a Page line", () => {
    expect(tokenizeLine('Page "Log in" id=login')).toEqual([
      { text: "Page", token: "typeName" },
      { text: " ", token: null },
      { text: '"Log in"', token: "string" },
      { text: " ", token: null },
      { text: "id=login", token: "attributeName" },
    ]);
  });

  it("finds a number attribute value as part of the attribute", () => {
    expect(marked("Box width=3")).toEqual([
      ["typeName", "Box"],
      ["attributeName", "width=3"],
    ]);
  });

  it("finds dashed attribute names together with their bare values", () => {
    expect(marked("Text link-to=forgot")).toEqual([
      ["typeName", "Text"],
      ["attributeName", "link-to=forgot"],
    ]);
    expect(marked("Text font-size=lg")).toEqual([
      ["typeName", "Text"],
      ["attributeName", "font-size=lg"],
    ]);
    expect(marked("Page id=page-1")).toEqual([
      ["typeName", "Page"],
      ["attributeName", "id=page-1"],
    ]);
  });

  it("finds the type of a node without text or attributes", () => {
    expect(marked("Spacer")).toEqual([["typeName", "Spacer"]]);
    expect(marked("  BoxRow")).toEqual([["typeName", "BoxRow"]]);
    expect(marked("  Field")).toEqual([["typeName", "Field"]]);
  });

  it("finds an aspect ratio as one attribute", () => {
    expect(marked("Image aspect-ratio=16:9")).toEqual([
      ["typeName", "Image"],
      ["attributeName", "aspect-ratio=16:9"],
    ]);
  });
});

describe("tokenizeLine macros and pointers", () => {
  it("finds the keyword, the macro name and the parameters of a Def", () => {
    expect(marked("Def Field $label $value")).toEqual([
      ["keyword", "Def"],
      ["typeName", "Field"],
      ["variableName", "$label"],
      ["variableName", "$value"],
    ]);
  });

  it("finds Each, its list and its as attribute", () => {
    expect(marked("Each $items as=item")).toEqual([
      ["keyword", "Each"],
      ["variableName", "$items"],
      ["attributeName", "as=item"],
    ]);
  });

  it("keeps a parameter inside quotes part of the string", () => {
    expect(tokenizeLine('Text "$1"')).toEqual([
      { text: "Text", token: "typeName" },
      { text: " ", token: null },
      { text: '"$1"', token: "string" },
    ]);
  });

  it("makes the whole of $1 and of a field reference a parameter", () => {
    expect(marked("PageTitle $1")).toEqual([
      ["typeName", "PageTitle"],
      ["variableName", "$1"],
    ]);
    expect(marked("Text $item.title")).toEqual([
      ["typeName", "Text"],
      ["variableName", "$item.title"],
    ]);
  });

  it("does not take $12 for a parameter", () => {
    expect(marked("Text $12").filter(([token]) => token === "variableName")).toEqual([]);
  });

  it("finds a pointer with its suffix, and an attribute whose name is a field", () => {
    expect(marked("TableColumn @User.FirstName.label width=4")).toEqual([
      ["typeName", "TableColumn"],
      ["variableName.special", "@User.FirstName.label"],
      ["attributeName", "width=4"],
    ]);
    expect(marked('Card item.title="Hi"')).toEqual([
      ["typeName", "Card"],
      ["attributeName", "item.title="],
      ["string", '"Hi"'],
    ]);
  });
});

describe("tokenizeLine robustness", () => {
  it("does not throw on an unterminated quote and still tokenises the rest of the line", () => {
    const pieces = tokenizeLine('Box "abc width=3');
    expect(pieces[0]).toEqual({ text: "Box", token: "typeName" });
    expect(pieces.map((piece) => piece.text).join("")).toBe('Box "abc width=3');
    expect(pieces.some((piece) => piece.token === "attributeName" && piece.text === "width=3")).toBe(true);
  });

  it("gives no pieces for an empty line", () => {
    expect(tokenizeLine("")).toEqual([]);
  });

  it("keeps every character of the line", () => {
    const line = 'Def  Field $a   @User.Name "x"  y=1 # z';
    expect(
      tokenizeLine(line)
        .map((piece) => piece.text)
        .join(""),
    ).toBe(line);
  });
});

describe("trellisLanguage and trellisHighlighter", () => {
  it("define the language and the highlighter", () => {
    expect(trellisLanguage.name).toBe("trellis");
    expect(trellisHighlighter.style).toBeTypeOf("function");
  });
});
