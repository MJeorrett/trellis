import { describe, expect, it } from "vitest";
import { seedMacrosSource } from "@/macros/api";
import { featuresListSource } from "@/features/wireframes/features-list";
import { pageLinksSource } from "@/features/wireframes/page-links";
import { wireFrameEditorSource } from "@/features/wireframes/wire-frame-editor";
import { compileSyntax } from "./compile";
import { parseSyntax } from "./parse";

const field = `Def Field $label $value $font
  BoxRow
    Text "$label" font=$font
    Box "$value"
`;

describe("compileSyntax", () => {
  it("gives the same AST for the specification's example as writing it by hand", () => {
    const withMacro = `${field}
Page "Profile"
  Field label="First Name" value="Please enter First Name..." font=bold
`;
    const byHand = `Page "Profile"
  BoxRow
    Text "First Name" font=bold
    Box "Please enter First Name..."
`;
    const result = compileSyntax(withMacro);
    expect(result.ok).toBe(true);
    expect(result).toEqual(parseSyntax(byHand));
  });

  it("gives exactly the result of parseSyntax for a macro-free source, including the sample wire frames", () => {
    for (const source of [pageLinksSource, featuresListSource, "", 'Page "A"\n  Box', 'Page "A"\n  Bogus', "Bogus"]) {
      expect(compileSyntax(source)).toEqual(parseSyntax(source));
    }
  });

  it("has no macros in the seeded wire frames, so the seeded global macros do not change them", () => {
    for (const source of [wireFrameEditorSource, pageLinksSource, featuresListSource]) {
      expect(source).not.toMatch(/^ *Def /m);
      expect(compileSyntax(source)).toEqual(parseSyntax(source));
      expect(compileSyntax(source, seedMacrosSource)).toEqual(parseSyntax(source));
    }
  });

  it("lets a wire frame use the seeded global Field macro", () => {
    const withMacro = 'Page "Log in"\n  Field label="Email" value="you@example.com"\n';
    const byHand = 'Page "Log in"\n  Box\n    Text "Email" font=bold\n    Box "you@example.com"\n';
    expect(compileSyntax(withMacro, seedMacrosSource)).toEqual(parseSyntax(byHand));
    expect(compileSyntax(withMacro).ok).toBe(false);
  });

  it("is unaware of macros in parseSyntax, which still rejects a macro use as an unknown type", () => {
    expect(parseSyntax(field).ok).toBe(false);
    const use = parseSyntax('Page "P"\n  Field label="a"');
    expect(!use.ok && use.error).toMatch(/^Line 2: Unknown type "Field"/);
  });

  it("returns a preprocessor error as it is", () => {
    const result = compileSyntax(`${field}Page "P"\n  Field label="a"`);
    expect(result).toEqual({ ok: false, error: 'Line 6: Missing argument "value" for macro "Field"' });
  });

  describe("error lines", () => {
    it("reports a core error in text that is not from a macro at its own line, after a Def", () => {
      const result = compileSyntax(`${field}Page "P"\n  Bogus`);
      expect(!result.ok && result.error).toMatch(/^Line 6: Unknown type "Bogus"/);
      expect(!result.ok && result.error).not.toContain("in macro");
    });

    it("reports a core error in text from a macro at the use line, naming the macro", () => {
      const source = `Def Bad
  Spacer
Page "P"
  Text "ok"
  Bad
`;
      expect(compileSyntax(source)).toEqual({
        ok: false,
        error: 'Line 5: Spacer must be inside a Row or BoxRow (in macro "Bad")',
      });
    });

    it("names the macro whose body holds the line when macros are nested", () => {
      const source = `Def Inner
  Spacer
Def Outer
  Row
    Text "x"
  Inner
Page "P"
  Outer
`;
      expect(compileSyntax(source)).toEqual({
        ok: false,
        error: 'Line 8: Spacer must be inside a Row or BoxRow (in macro "Inner")',
      });
    });

    it("keeps a line after an expansion pointing at the line as written", () => {
      const source = `${field}Page "P"
  Field label="a" value="b" font=bold
  Field label="c" value="d" font=bold
  Bogus`;
      const result = compileSyntax(source);
      expect(!result.ok && result.error).toMatch(/^Line 8: Unknown type "Bogus"/);
    });
  });
});
