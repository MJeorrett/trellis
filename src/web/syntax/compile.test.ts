import { describe, expect, it } from "vitest";
import type { DataDictionaryRow } from "@/data-dictionary/schema";
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
    const withMacro = 'Page "Log in"\n  Field for="Email"|"you@example.com"\n';
    const byHand = 'Page "Log in"\n  Text "Email"\n  Box "you@example.com"\n';
    expect(compileSyntax(withMacro, seedMacrosSource)).toEqual(parseSyntax(byHand));
    expect(compileSyntax(withMacro).ok).toBe(false);
  });

  it("lets a wire frame use the seeded global PageTitle macro", () => {
    const withMacro = 'Page "Home"\n  PageTitle "My Page"\n';
    const byHand = 'Page "Home"\n  Text "My Page" font=bold font-size=lg\n';
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

describe("compileSyntax: data references", () => {
  const rows: DataDictionaryRow[] = [
    { entity: "User", field: "FirstName", dataType: "string", label: "First Name", mockValues: "Jane" },
    { entity: "User", field: "LastName", dataType: "string", label: "Last Name", mockValues: "Smith" },
    { entity: "User", field: "Age", dataType: "int", label: "Age", mockValues: "30" },
  ];
  const fieldMacro = `Def Field $field=label|mockValues
  Text "$field.label"
  Box "$field.mockValues"
`;

  it("resolves a pointer written directly, of each kind", () => {
    const source = `Page "P"
  Text @User.FirstName.label
  Box @User.FirstName
  Box @User.FirstName.mock
  Text @User.Age.dataType
  Text @User.Age.entity
  Text @User.Age.field
`;
    const byHand = `Page "P"
  Text "First Name"
  Box "Jane"
  Box "Jane"
  Text "int"
  Text "User"
  Text "Age"
`;
    expect(compileSyntax(source, undefined, rows)).toEqual(parseSyntax(byHand));
  });

  it("keeps the attributes of a node with a pointer", () => {
    const result = compileSyntax('Page "P"\n  Row\n    Text @User.LastName.label font=bold width=4', undefined, rows);
    expect(result).toEqual(parseSyntax('Page "P"\n  Row\n    Text "Last Name" font=bold width=4'));
  });

  it("resolves the example of the capability: a macro with an object parameter and a pointer argument", () => {
    const source = `${fieldMacro}
Page "Profile"
  Field field=@User.FirstName
  Text @User.LastName.label font=bold
  Box @User.LastName
`;
    const byHand = `Page "Profile"
  Text "First Name"
  Box "Jane"
  Text "Last Name" font=bold
  Box "Smith"
`;
    expect(compileSyntax(source, undefined, rows)).toEqual(parseSyntax(byHand));
  });

  it("resolves pointers in the global macros and in a plain parameter", () => {
    const shared = 'Def Label $text\n  Text "$text"\n';
    const result = compileSyntax('Page "P"\n  Label text=@User.Age.label', shared, rows);
    expect(result).toEqual(parseSyntax('Page "P"\n  Text "Age"'));
  });

  it("gives the same result as before for a source with no pointer, whatever the data dictionary", () => {
    for (const source of [pageLinksSource, featuresListSource, "", 'Page "A"\n  Box', 'Page "A"\n  Bogus', "Bogus"]) {
      expect(compileSyntax(source, undefined, rows)).toEqual(parseSyntax(source));
      expect(compileSyntax(source, undefined, [])).toEqual(parseSyntax(source));
    }
    const withMacro = `${field}Page "P"\n  Field label="a" value="b" font=bold\n`;
    expect(compileSyntax(withMacro, undefined, rows)).toEqual(compileSyntax(withMacro));
  });

  it("treats a quoted pointer as plain text", () => {
    expect(compileSyntax('Page "P"\n  Text "@User.FirstName"', undefined, rows)).toEqual(
      parseSyntax('Page "P"\n  Text "@User.FirstName"'),
    );
  });

  it("reports a resolver error at the line of the source as written", () => {
    const source = `${field}Page "P"\n  Box "ok"\n  Box @User.Nope\n`;
    expect(compileSyntax(source, undefined, rows)).toEqual({
      ok: false,
      error: 'Line 7: Unknown field "User.Nope"',
    });
    expect(compileSyntax('Page "P"\n  Box @Nope.Name', undefined, rows)).toEqual({
      ok: false,
      error: 'Line 2: Unknown entity "Nope"',
    });
  });

  it("reports an unknown entity as an error when no data dictionary is given", () => {
    expect(compileSyntax('Page "P"\n  Box @User.FirstName')).toEqual({
      ok: false,
      error: 'Line 2: Unknown entity "User"',
    });
  });

  it("reports a pointer that came from a macro at the use line, naming the macro", () => {
    const source = `${fieldMacro}Page "Profile"\n  Field field=@Nope.FirstName\n`;
    expect(compileSyntax(source, undefined, rows)).toEqual({
      ok: false,
      error: 'Line 5: Unknown entity "Nope" (in macro "Field")',
    });
    const inBody = 'Def Name\n  Text @User.Nope\nPage "P"\n  Text "ok"\n  Name\n';
    expect(compileSyntax(inBody, undefined, rows)).toEqual({
      ok: false,
      error: 'Line 5: Unknown field "User.Nope" (in macro "Name")',
    });
  });

  it("reports a pointer that came from an argument at the use line", () => {
    const source = `${fieldMacro}Page "Profile"\n  Text "ok"\n  Field field=@User.Missing\n`;
    expect(compileSyntax(source, undefined, rows)).toEqual({
      ok: false,
      error: 'Line 6: Unknown field "User.Missing" (in macro "Field")',
    });
  });

  it("returns a pointer shape error from the parser at its own line", () => {
    expect(compileSyntax('Page "P"\n  Box @user.Name', undefined, rows)).toEqual({
      ok: false,
      error:
        'Line 2: Invalid pointer "@user.Name" (expected @Entity.Field or @Entity.Field.<entity|field|dataType|label|mock>)',
    });
  });

  it("returns a preprocessor error for an invalid pointer argument as it is", () => {
    const source = `${fieldMacro}Page "P"\n  Field field=@bad\n`;
    expect(compileSyntax(source, undefined, rows)).toEqual({
      ok: false,
      error:
        'Line 5: Invalid pointer "@bad" (expected @Entity.Field or @Entity.Field.<entity|field|dataType|label|mock>)',
    });
  });

  it("does not resolve a pointer on a Spacer, an Image or a Page", () => {
    expect(compileSyntax('Page "P"\n  Image @User.FirstName', undefined, rows).ok).toBe(false);
    expect(compileSyntax('Page "P"\n  Row\n    Spacer @User.FirstName', undefined, rows).ok).toBe(false);
    expect(compileSyntax("Page @User.FirstName", undefined, rows).ok).toBe(false);
  });
});

describe("compileSyntax: tables", () => {
  const rows: DataDictionaryRow[] = [
    { entity: "User", field: "Name", dataType: "string", label: "Name", mockValues: "Jane" },
    { entity: "User", field: "Email", dataType: "string", label: "Email address", mockValues: "jane@example.com" },
    { entity: "User", field: "Nick", dataType: "string", label: "", mockValues: "" },
  ];
  const byHand = `Page "Users"
  Table
    TableColumn "Name"|"Jane" width=4
    TableColumn "Email address"|"jane@example.com" width=5
    TableColumn "Manual Column"|"mock 1","mock 2","mock 3"
    TableColumn "Edit"|"Edit user" width=2 link-to=edit-user
`;

  it("resolves the pointer columns of the example table against the data dictionary", () => {
    const source = `Page "Users"
  Table
    TableColumn @User.Name width=4
    TableColumn @User.Email width=5
    TableColumn "Manual Column"|"mock 1","mock 2","mock 3"
    TableColumn "Edit"|"Edit user" width=2 link-to=edit-user
`;
    const result = compileSyntax(source, undefined, rows);
    expect(result.ok).toBe(true);
    expect(result).toEqual(parseSyntax(byHand));
  });

  it("fills the cells of a pointer column from the `;` separated mock values, cycled by the viewer", () => {
    const withRoles = [
      ...rows,
      { entity: "User", field: "Role", dataType: "string", label: "Role", mockValues: "Organisation Admin;Banan" },
    ] satisfies DataDictionaryRow[];
    expect(compileSyntax('Page "P"\n  Table\n    TableColumn @User.Role', undefined, withRoles)).toEqual(
      parseSyntax('Page "P"\n  Table\n    TableColumn "Role"|"Organisation Admin","Banan"'),
    );
  });

  it("resolves a column whose field has an empty label and mock value", () => {
    const result = compileSyntax('Page "P"\n  Table\n    TableColumn @User.Nick', undefined, rows);
    expect(result).toEqual(parseSyntax('Page "P"\n  Table\n    TableColumn ""|""'));
  });

  it("reports an unknown entity and an unknown field at the line of the column", () => {
    expect(compileSyntax('Page "P"\n  Table\n    TableColumn @Nope.Name', undefined, rows)).toEqual({
      ok: false,
      error: 'Line 3: Unknown entity "Nope"',
    });
    expect(compileSyntax('Page "P"\n  Table\n    TableColumn "A"\n    TableColumn @User.Nope', undefined, rows)).toEqual({
      ok: false,
      error: 'Line 4: Unknown field "User.Nope"',
    });
  });

  it("reports a pointer column error from a macro body at the use line, naming the macro", () => {
    const source = `Def Users
  Table
    TableColumn @User.Nope
Page "P"
  Text "ok"
  Users
`;
    expect(compileSyntax(source, undefined, rows)).toEqual({
      ok: false,
      error: 'Line 6: Unknown field "User.Nope" (in macro "Users")',
    });
  });

  it("expands a table in a macro body, with $param in a header and in a value list", () => {
    const source = `Def Listing $title $first $second
  Table
    TableColumn "$title"|"$first","$second" width=6
    TableColumn @User.Name
Page "P"
  Listing title="Fruit" first="Apple" second="Pear"
`;
    const expected = `Page "P"
  Table
    TableColumn "Fruit"|"Apple","Pear" width=6
    TableColumn "Name"|"Jane"
`;
    expect(compileSyntax(source, undefined, rows)).toEqual(parseSyntax(expected));
  });

  it("passes a pointer argument to a column in a macro body", () => {
    const source = `Def Col $field
  TableColumn $field
Page "P"
  Table
    Col field=@User.Name
`;
    expect(compileSyntax(source, undefined, rows)).toEqual(
      parseSyntax('Page "P"\n  Table\n    TableColumn "Name"|"Jane"'),
    );
  });

  it("reports a table error in a macro body at the use line, naming the macro", () => {
    const source = `Def Empty
  Table
Page "P"
  Empty
`;
    expect(compileSyntax(source, undefined, rows)).toEqual({
      ok: false,
      error: 'Line 4: Table must have at least one TableColumn (in macro "Empty")',
    });
  });
});

describe("compileSyntax: comments", () => {
  const expected = parseSyntax('Page "P"\n  Box\n    Text "x"\n  Box');

  it("gives the same AST as the source without the comments", () => {
    const source = `# a macro
Def Item
# its body
  Box
    Text "x"

# the page
Page "P"
# the item
  Item
  Box
# the end`;
    expect(compileSyntax(source)).toEqual(expected);
  });

  it("maps a core error found after a comment to the original line", () => {
    const source = `# note
Def Item
# note
  Box
# note
Page "P"
# note
  Item
# note
  Spacer`;
    expect(compileSyntax(source)).toEqual({ ok: false, error: "Line 10: Spacer must be inside a Row or BoxRow" });
  });

  it("names the macro for an error inside its body, at the use line", () => {
    const source = `Def Bad
# note
  Spacer
# note
Page "P"
# note
  Bad`;
    expect(compileSyntax(source)).toEqual({
      ok: false,
      error: 'Line 7: Spacer must be inside a Row or BoxRow (in macro "Bad")',
    });
  });

  it("maps a data reference error after a comment to the original line", () => {
    const source = '# note\nPage "P"\n# note\n  Text @User.Name';
    expect(compileSyntax(source, undefined, [])).toEqual({ ok: false, error: 'Line 4: Unknown entity "User"' });
  });
});
