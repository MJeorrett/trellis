import { describe, expect, it } from "vitest";
import { expandMacros, FieldNameSchema, MacroDefinitionSchema, MacroNameSchema, ParamNameSchema } from "./macros";

const expand = (source: string) => {
  const result = expandMacros(source);
  if (!result.ok) throw new Error(result.error);
  return result;
};
const errorOf = (source: string) => {
  const result = expandMacros(source);
  return result.ok ? undefined : result.error;
};

const expand2 = (source: string, shared: string) => {
  const result = expandMacros(source, shared);
  if (!result.ok) throw new Error(result.error);
  return result;
};
const errorOf2 = (source: string, shared: string) => {
  const result = expandMacros(source, shared);
  return result.ok ? undefined : result.error;
};

const expectedParam = "(expected $name or $name=field|field)";

const field = `Def Field $label $value $font
  BoxRow
    Text "$label" font=$font
    Box "$value"
`;

describe("definition schemas", () => {
  it("accepts Pascal case macro names that are not reserved", () => {
    expect(MacroNameSchema.safeParse("Field").success).toBe(true);
    expect(MacroNameSchema.safeParse("NavTabs2").success).toBe(true);
    for (const name of ["field", "Nav_Tabs", "2Field", "", "Box", "Page", "Def", "Spacer", "Table", "TableColumn"]) {
      expect(MacroNameSchema.safeParse(name).success).toBe(false);
    }
  });

  it("accepts parameter names of letters, digits and _ starting with a letter", () => {
    expect(ParamNameSchema.safeParse("label_2").success).toBe(true);
    expect(ParamNameSchema.safeParse("2label").success).toBe(false);
    expect(ParamNameSchema.safeParse("").success).toBe(false);
  });

  it("accepts field names like parameter names", () => {
    expect(FieldNameSchema.safeParse("title_2").success).toBe(true);
    for (const name of ["2title", "", "a.b", "a|b"]) expect(FieldNameSchema.safeParse(name).success).toBe(false);
  });

  it("requires at least one body line", () => {
    const definition = { name: "A", params: [], objects: {}, positional: false };
    expect(MacroDefinitionSchema.safeParse({ ...definition, body: [] }).success).toBe(false);
    expect(MacroDefinitionSchema.safeParse({ ...definition, body: ["Box"] }).success).toBe(true);
  });

  it("requires the objects map, whose parameters have at least one valid field", () => {
    const definition = { name: "A", params: ["a"], positional: false, body: ["Box"] };
    expect(MacroDefinitionSchema.safeParse(definition).success).toBe(false);
    expect(MacroDefinitionSchema.safeParse({ ...definition, objects: { a: ["x", "y"] } }).success).toBe(true);
    expect(MacroDefinitionSchema.safeParse({ ...definition, objects: { a: [] } }).success).toBe(false);
    expect(MacroDefinitionSchema.safeParse({ ...definition, objects: { a: ["1x"] } }).success).toBe(false);
    expect(MacroDefinitionSchema.safeParse({ ...definition, objects: { "1a": ["x"] } }).success).toBe(false);
  });
});

describe("a source without macros", () => {
  it("expands to exactly the same text, each line from itself", () => {
    const source = 'Page "A"\n  Box\n\n    Text "x"\n';
    const result = expand(source);
    expect(result.source).toBe(source);
    result.origins.forEach((origin, index) => expect(origin).toEqual({ line: index + 1 }));
    expect(result.origins).toHaveLength(source.split("\n").length);
  });

  it("expands the empty source to itself", () => {
    expect(expand("")).toEqual({ ok: true, source: "", origins: [{ line: 1 }] });
  });
});

describe("Def", () => {
  it("produces no output, before, between and after pages", () => {
    const source = `Def A
  Box
Page "One"
Def B
  Text "b"
Page "Two"
Def C
  Box
`;
    expect(expand(source).source).toBe('Page "One"\nPage "Two"');
  });

  it("allows a macro without parameters and a body with several first-level lines", () => {
    const result = expand('Def Pair\n  Box "a"\n  Box "b"\nPage "P"\n  Pair\n');
    expect(result.source).toBe('Page "P"\n  Box "a"\n  Box "b"\n');
  });

  it("ends the body at the next line that is not indented, ignoring blank lines in it", () => {
    const result = expand('Def A\n  Box\n\n  Text "x"\n\nPage "P"\n  A');
    expect(result.source).toBe('Page "P"\n  Box\n  Text "x"');
  });
});

describe("using a macro", () => {
  it("expands the specification's example", () => {
    const source = `${field}
Page "Profile"
  Field label="First Name" value="Please enter First Name..." font=bold
  Field label="Last Name" value="Please enter Last Name..." font=bold
`;
    expect(expand(source).source).toBe(`Page "Profile"
  BoxRow
    Text "First Name" font=bold
    Box "Please enter First Name..."
  BoxRow
    Text "Last Name" font=bold
    Box "Please enter Last Name..."
`);
  });

  it("strips the quotes of an argument and treats a bare value like the quoted one", () => {
    const a = expand(`${field}Page "P"\n  Field label="x y" value=v font=bold`);
    const b = expand(`${field}Page "P"\n  Field label="x y" value="v" font="bold"`);
    expect(a.source).toBe('Page "P"\n  BoxRow\n    Text "x y" font=bold\n    Box "v"');
    expect(b.source).toBe(a.source);
  });

  it("takes the arguments in any order and allows an empty one", () => {
    const result = expand(`${field}Page "P"\n  Field font=bold value="" label="L"`);
    expect(result.source).toBe('Page "P"\n  BoxRow\n    Text "L" font=bold\n    Box ""');
  });

  it("substitutes a parameter anywhere on the line: type, text, attribute key and value", () => {
    const source = 'Def Any $type $text $key $value\n  $type "$text" $key=$value\nPage "P"\n  Any type=Text text="Hi" key=font value=bold';
    expect(expand(source).source).toBe('Page "P"\n  Text "Hi" font=bold');
  });

  it("substitutes a parameter name as the longest run, and leaves a lone $ or $5 alone", () => {
    const source = 'Def A $a $a_b\n  Text "$a_b $a $5 $"\nPage "P"\n  A a=1 a_b=2';
    expect(expand(source).source).toBe('Page "P"\n  Text "2 1 $5 $"');
  });

  it("does not substitute a value that itself contains $name", () => {
    const source = 'Def A $a $b\n  Text "$a $b"\nPage "P"\n  A a="$b" b=x';
    expect(expand(source).source).toBe('Page "P"\n  Text "$b x"');
  });

  it("allows a declared parameter that the body never uses", () => {
    expect(expand('Def A $unused\n  Box\nPage "P"\n  A unused=x').source).toBe('Page "P"\n  Box');
  });

  it("re-indents the body to the use line's indentation", () => {
    const source = 'Def A\n  Box\n    Text "x"\nPage "P"\n  Box\n    A\n      ';
    expect(expand(source).source).toBe('Page "P"\n  Box\n    Box\n      Text "x"\n      ');
  });

  it("reports every expanded line at the use line, with the macro", () => {
    const source = 'Def A\n  Box\n    Text "x"\nPage "P"\n  A\n  Box';
    expect(expand(source).origins).toEqual([
      { line: 4 },
      { line: 5, macro: "A" },
      { line: 5, macro: "A" },
      { line: 6 },
    ]);
  });
});

describe("the unlabeled argument $1", () => {
  const title = 'Def PageTitle\n  Text "$1" font=bold font-size=lg\n';

  it("takes the quoted text after the macro name", () => {
    expect(expand(`${title}Page "P"\n  PageTitle "My Page"`).source).toBe(
      'Page "P"\n  Text "My Page" font=bold font-size=lg',
    );
  });

  it("takes a bare value, and an empty one", () => {
    expect(expand(`${title}Page "P"\n  PageTitle Home`).source).toContain('Text "Home"');
    expect(expand(`${title}Page "P"\n  PageTitle ""`).source).toContain('Text ""');
  });

  it("allows spaces and = inside quotes", () => {
    expect(expand(`${title}Page "P"\n  PageTitle "a b=c"`).source).toContain('Text "a b=c"');
  });

  it("goes first, before the named arguments, which can still be in any order", () => {
    const source = 'Def Field $value $font\n  Box\n    Text "$1" font=$font\n    Box "$value"\nPage "P"\n  Field "First Name" font=bold value="x"';
    expect(expand(source).source).toBe('Page "P"\n  Box\n    Text "First Name" font=bold\n    Box "x"');
  });

  it("can be used anywhere on a body line, more than once, and in an attribute position", () => {
    const source = 'Def A\n  $1 "$1" link-to=$1\nPage "P"\n  A Text';
    expect(expand(source).source).toBe('Page "P"\n  Text "Text" link-to=Text');
  });

  it("is passed on to a nested macro, and does not need a Def parameter", () => {
    const source = `${title}Def Wrapped\n  Box\n    PageTitle "$1"\nPage "P"\n  Wrapped "Deep"`;
    expect(expand(source).source).toBe('Page "P"\n  Box\n    Text "Deep" font=bold font-size=lg');
  });

  it("is not substituted again inside a value", () => {
    expect(expand('Def A $a\n  Text "$1 $a"\nPage "P"\n  A "$a" a=x').source).toBe('Page "P"\n  Text "$a x"');
  });

  it("is only $1 on its own: $12, $1a, $1_ and $0 stay plain text", () => {
    const source = 'Def A\n  Text "$1 $12 $1a $1_ $0"\nPage "P"\n  A x';
    expect(expand(source).source).toBe('Page "P"\n  Text "x $12 $1a $1_ $0"');
  });

  it("is not needed by a macro that does not mention it", () => {
    expect(expand('Def A\n  Box\nPage "P"\n  A').source).toBe('Page "P"\n  Box');
  });
});

describe("object parameters", () => {
  const card = `Def Card $item=title|description|id
  Box
    Text "$item.title" font=bold
    Text "$item.description"
    Text "$item.id"
`;
  const cardOf = (title: string, description: string, id: string) =>
    `Page "P"\n  Box\n    Text "${title}" font=bold\n    Text "${description}"\n    Text "${id}"`;
  const use = (line: string) => expand(`${card}Page "P"\n  ${line}`).source;

  describe("in a Def", () => {
    it("takes one field", () => {
      expect(expand('Def A $x=only\n  Text "$x.only"\nPage "P"\n  A x=v').source).toBe('Page "P"\n  Text "v"');
      expect(expand('Def A $x=only\n  Text "$x.only"\nPage "P"\n  A x.only=v').source).toBe('Page "P"\n  Text "v"');
    });

    it("takes several fields", () => {
      expect(use('Card item.title="Hi" item.description="Text" item.id="1"')).toBe(cardOf("Hi", "Text", "1"));
    });

    it("mixes with plain parameters, in any order", () => {
      const source = 'Def A $label $item=a|b $font\n  Text "$label $item.a $item.b" font=$font\nPage "P"\n  A';
      expect(expand(`${source} label=L item=1|2 font=bold`).source).toBe('Page "P"\n  Text "L 1 2" font=bold');
      expect(expand(`${source} item.b=2 font=bold item.a=1 label=L`).source).toBe('Page "P"\n  Text "L 1 2" font=bold');
    });

    it("can sit beside the unlabeled argument $1", () => {
      const source = 'Def A $item=a|b\n  Text "$1 $item.a $item.b"\nPage "P"\n  A';
      expect(expand(`${source} "p" item=1|2`).source).toBe('Page "P"\n  Text "p 1 2"');
      expect(expand(`${source} "p" item.b=2 item.a=1`).source).toBe('Page "P"\n  Text "p 1 2"');
    });

    it("does not take a parameter named like an Object.prototype member for an object", () => {
      const source = 'Def A $constructor\n  Text "$constructor"\nPage "P"\n  A constructor=v';
      expect(expand(source).source).toBe('Page "P"\n  Text "v"');
    });

    it("lists every parameter, plain or object, and a macro without objects behaves as before", () => {
      expect(expand('Def A $a $b\n  Text "$a$b"\nPage "P"\n  A b=2 a=1').source).toBe('Page "P"\n  Text "12"');
    });
  });

  describe("in the body", () => {
    it("substitutes a field several times and in an attribute value, key or type", () => {
      const source = 'Def A $x=a|b\n  $x.a "$x.a $x.a" $x.b=$x.a link-to=$x.b\nPage "P"\n  A x=Box|font';
      expect(expand(source).source).toBe('Page "P"\n  Box "Box Box" font=Box link-to=font');
    });

    it("never double-quotes the value", () => {
      expect(use('Card item="Hi"|""|x')).toBe(cardOf("Hi", "", "x"));
    });

    it("leaves .x after a plain parameter as text", () => {
      expect(expand('Def A $label\n  Text "$label.x $label"\nPage "P"\n  A label=v').source).toBe('Page "P"\n  Text "v.x v"');
    });

    it("leaves .x after $1 as text", () => {
      expect(expand('Def A\n  Text "$1.x"\nPage "P"\n  A v').source).toBe('Page "P"\n  Text "v.x"');
    });

    it("leaves what is not a field name after a field alone", () => {
      const source = 'Def A $x=a\n  Text "$x.a.b $x.a-"\nPage "P"\n  A x=v';
      expect(expand(source).source).toBe('Page "P"\n  Text "v.b v-"');
    });

    it("can pass a field on to a nested macro as a plain argument", () => {
      const source = 'Def Inner $label\n  Text "$label"\nDef Outer $item=title|id\n  Inner label="$item.title"\n  Inner label=$item.id\nPage "P"\n  Outer item="Hi there"|7';
      expect(expand(source).source).toBe('Page "P"\n  Text "Hi there"\n  Text "7"');
    });

    it("can pass a field on to a nested macro as a field", () => {
      const source = `${card}Def Wrapped $record=name|key\n  Card item.title="$record.name" item.description="d" item.id=$record.key\nPage "P"\n  Wrapped record="N"|k`;
      expect(expand(source).source).toBe(cardOf("N", "d", "k"));
    });

    it("does not substitute a value that itself contains $name or a field reference", () => {
      expect(use('Card item="$item.id"|b|c')).toBe(cardOf("$item.id", "b", "c"));
    });
  });

  describe("arguments", () => {
    it("gives the same expansion in the dotted form, in any order, and the piped form", () => {
      const piped = use('Card item="Hi"|"Text"|"1"');
      expect(piped).toBe(cardOf("Hi", "Text", "1"));
      expect(use('Card item.title="Hi" item.description="Text" item.id="1"')).toBe(piped);
      expect(use('Card item.id=1 item.title=Hi item.description=Text')).toBe(piped);
      expect(use('Card item.description="Text" item.id="1" item.title="Hi"')).toBe(piped);
    });

    it("takes quoted and bare values in the piped form, in the declared order", () => {
      expect(use('Card item=Hi|"Two words"|3')).toBe(cardOf("Hi", "Two words", "3"));
      expect(use('Card item="Hi"|Text|"1"')).toBe(cardOf("Hi", "Text", "1"));
    });

    it("takes empty values and values containing | or spaces when quoted", () => {
      expect(use('Card item=""|""|""')).toBe(cardOf("", "", ""));
      expect(use('Card item="a|b c"|"|"|x')).toBe(cardOf("a|b c", "|", "x"));
      expect(use('Card item.title="" item.description="a | b" item.id=""')).toBe(cardOf("", "a | b", ""));
    });

    it("combines with the unlabeled argument and plain named arguments", () => {
      const source = 'Def A $label $item=a|b\n  Text "$1 $label $item.a $item.b"\nPage "P"\n  ';
      for (const invocation of ['A "p" label=L item="1"|"2"', 'A "p" item=1|2 label=L', 'A p label=L item.b=2 item.a=1']) {
        expect(expand(`${source}${invocation}`).source).toBe('Page "P"\n  Text "p L 1 2"');
      }
    });

    it("takes a plain named argument for a one-field object as the piped form", () => {
      expect(expand('Def A $x=only\n  Text "$x.only"\nPage "P"\n  A x="a b"').source).toBe('Page "P"\n  Text "a b"');
    });

    it("keeps a | in the value of a plain parameter", () => {
      expect(expand('Def A $a\n  Text "$a"\nPage "P"\n  A a=x|y').source).toBe('Page "P"\n  Text "x|y"');
    });
  });

  describe("errors", () => {
    const pair = 'Def A $a=x|y\n  Box\nPage "P"\n  ';
    const cases: [string, string, string][] = [
      ["no field after =", "Def A $a=\n  Box", `Line 1: Invalid parameter "$a=" ${expectedParam}`],
      ["an empty last field", "Def A $a=x|\n  Box", `Line 1: Invalid parameter "$a=x|" ${expectedParam}`],
      ["an empty middle field", "Def A $a=x||y\n  Box", `Line 1: Invalid parameter "$a=x||y" ${expectedParam}`],
      ["a field starting with a digit", "Def A $a=1x\n  Box", `Line 1: Invalid parameter "$a=1x" ${expectedParam}`],
      ["a field with a dot", "Def A $a=x.y\n  Box", `Line 1: Invalid parameter "$a=x.y" ${expectedParam}`],
      ["no name before =", "Def A $=x\n  Box", `Line 1: Invalid parameter "$=x" ${expectedParam}`],
      ["a name starting with a digit before =", "Def A $1a=x\n  Box", `Line 1: Invalid parameter "$1a=x" ${expectedParam}`],
      ["no $ before an object parameter", "Def A a=x\n  Box", `Line 1: Invalid parameter "a=x" ${expectedParam}`],
      ["a duplicate field", "Def A $a=x|y|x\n  Box", 'Line 1: Duplicate field "x" in parameter "$a"'],
      ["a duplicate parameter, plain then object", "Def A $a $a=x\n  Box", 'Line 1: Duplicate parameter "$a"'],
      ["a duplicate parameter, object then plain", "Def A $a=x $a\n  Box", 'Line 1: Duplicate parameter "$a"'],
      ["a bare object parameter", 'Def A $a=x\n  Text "$a"', 'Line 2: Parameter "$a" is an object (use $a.<field>)'],
      ["a bare object parameter in an attribute", "Def A $a=x\n  Box font=$a", 'Line 2: Parameter "$a" is an object (use $a.<field>)'],
      ["an object parameter followed by a dot and a non-field", 'Def A $a=x\n  Text "$a. $a.1"', 'Line 2: Parameter "$a" is an object (use $a.<field>)'],
      ["an undeclared field", 'Def A $a=x\n  Text "$a.x"\n  Text "$a.y"', 'Line 3: Unknown field "y" on parameter "$a"'],
      ["a field with different case", 'Def A $a=x\n  Text "$a.X"', 'Line 2: Unknown field "X" on parameter "$a"'],
      ["an undeclared parameter with a field", 'Def A $a=x\n  Text "$b.x"', 'Line 2: Unknown parameter "$b" in macro "A"'],
      ["a field not given", `${pair}A a.x=1`, 'Line 4: Missing argument "a.y" for macro "A"'],
      ["no field given", `${pair}A`, 'Line 4: Missing argument "a.x" for macro "A"'],
      ["a field missing beside a plain parameter", 'Def A $p $a=x|y\n  Box\nPage "P"\n  A p=1 a.x=1', 'Line 4: Missing argument "a.y" for macro "A"'],
      ["a field the parameter does not have", `${pair}A a.x=1 a.y=2 a.z=3`, 'Line 4: Unknown argument "a.z" for macro "A"'],
      ["a field of a parameter that is not an object", 'Def A $p\n  Box\nPage "P"\n  A p.x=1', 'Line 4: Unknown argument "p.x" for macro "A"'],
      ["a field of an unknown parameter", `${pair}A b.x=1`, 'Line 4: Unknown argument "b.x" for macro "A"'],
      ["a field given twice", `${pair}A a.x=1 a.x=2`, 'Line 4: Duplicate argument "a.x"'],
      ["a field given by the dotted then the piped form", `${pair}A a.x=1 a=1|2`, 'Line 4: Duplicate argument "a.x"'],
      ["a field given by the piped then the dotted form", `${pair}A a=1|2 a.y=3`, 'Line 4: Duplicate argument "a.y"'],
      ["the piped form twice", `${pair}A a=1|2 a=3|4`, 'Line 4: Duplicate argument "a.x"'],
      ["too few piped values", `${pair}A a=1`, 'Line 4: Parameter "a" expects 2 values but got 1'],
      ["too many piped values", `${pair}A a=1|2|3`, 'Line 4: Parameter "a" expects 2 values but got 3'],
      ["a quoted value for a two-field object", `${pair}A a="1|2"`, 'Line 4: Parameter "a" expects 2 values but got 1'],
      ["an empty bare piped value", `${pair}A a=1||2`, 'Line 4: Invalid argument "a=1||2" (expected name=value or name="value")'],
      ["an empty first piped value", `${pair}A a=|2`, 'Line 4: Invalid argument "a=|2" (expected name=value or name="value")'],
      ["a trailing | in a piped value", `${pair}A a=1|`, 'Line 4: Invalid argument "a=1|" (expected name=value or name="value")'],
      ["text after a quoted piped value", `${pair}A a="1"x|2`, 'Line 4: Invalid argument "a="1"x|2" (expected name=value or name="value")'],
      ["an unterminated quote in a piped value", `${pair}A a=1|"2`, 'Line 4: Invalid argument "a=1|"2" (expected name=value or name="value")'],
      ["an invalid value of a field", `${pair}A a.x="1 a.y=2`, 'Line 4: Invalid argument "a.x="1" (expected name=value or name="value")'],
      [
        "a count error in a nested use, at the outer use",
        'Def Inner $a=x|y\n  Box\nDef Outer\n  Inner a=1\nPage "P"\n  Outer',
        'Line 6: Parameter "a" expects 2 values but got 1',
      ],
    ];

    for (const [name, source, message] of cases) {
      it(`reports ${name}`, () => {
        expect(errorOf(source)).toBe(message);
      });
    }
  });
});

describe("nested macros", () => {
  const nested = `${field}Def Row2 $title
  Box
    Field label="$title" value="v" font=bold
Page "P"
  Row2 title="T"
`;

  it("expands a macro used in a body, re-indenting each level and passing a parameter on", () => {
    expect(expand(nested).source).toBe(`Page "P"
  Box
    BoxRow
      Text "T" font=bold
      Box "v"
`);
  });

  it("names the macro whose body a line came from", () => {
    expect(expand(nested).origins).toEqual([
      { line: 8 },
      { line: 9, macro: "Row2" },
      { line: 9, macro: "Field" },
      { line: 9, macro: "Field" },
      { line: 9, macro: "Field" },
      { line: 10 },
    ]);
  });

  it("does not expand a macro that uses itself or one defined below it", () => {
    const self = expand('Def A\n  A\nPage "P"\n  A');
    expect(self.source).toBe('Page "P"\n  A');
    const below = expand('Def A\n  B\nDef B\n  Box\nPage "P"\n  A');
    expect(below.source).toBe('Page "P"\n  B');
  });
});

describe("shared macros", () => {
  const shared = `${field}Page "Sample"\n  Field label="a" value="b" font=bold\n`;

  it("defines the Defs of the shared text above the source, ignoring its other lines", () => {
    const result = expand2('Page "P"\n  Field label="L" value="V" font=bold', shared);
    expect(result.source).toBe('Page "P"\n  BoxRow\n    Text "L" font=bold\n    Box "V"');
    expect(result.origins.map((origin) => origin.line)).toEqual([1, 2, 2, 2]);
  });

  it("returns a source that uses nothing unchanged", () => {
    expect(expand2('Page "P"\n  Box', shared)).toMatchObject({ source: 'Page "P"\n  Box' });
  });

  it("lets a macro of the source use a shared one, and reports a duplicate against the source's line", () => {
    const own = 'Def Pair $x\n  Field label="$x" value="v" font=bold\nPage "P"\n  Pair x=1';
    expect(expand2(own, shared).source).toContain('Text "1" font=bold');
    expect(errorOf2('Def Field\n  Box', shared)).toBe('Line 1: Duplicate macro "Field"');
  });

  it("prefixes an error in the shared text, as its lines are not the source's", () => {
    expect(errorOf2('Page "P"', "Def a\n  Box")).toBe('Macros: Line 1: Invalid macro name "a" (expected Pascal case)');
    expect(errorOf2('Page "P"', "Page \"x\"\n  Def A\n    Box")).toBe("Macros: Line 2: Def must not be indented");
  });

  it("is the same as no shared text when it is empty", () => {
    expect(expandMacros(`${field}Page "P"`, "")).toEqual(expandMacros(`${field}Page "P"`));
  });
});

describe("errors", () => {
  const cases: [string, string, string][] = [
    ["an indented Def", ' Def A\n  Box', "Line 1: Def must not be indented"],
    ["an indented Def under a page", 'Page "P"\n  Def A\n    Box', "Line 2: Def must not be indented"],
    ["a Def without a name", "Def", "Line 1: Def requires a name"],
    ["a Def with a blank name", "Def \n  Box", "Line 1: Def requires a name"],
    ["a lower case name", "Def field\n  Box", 'Line 1: Invalid macro name "field" (expected Pascal case)'],
    ["a name with an underscore", "Def A_b\n  Box", 'Line 1: Invalid macro name "A_b" (expected Pascal case)'],
    ["a core type name", "Def Box\n  Box", 'Line 1: Macro name "Box" is reserved'],
    ["the name Page", "Def Page\n  Box", 'Line 1: Macro name "Page" is reserved'],
    ["the name Table", "Def Table\n  Box", 'Line 1: Macro name "Table" is reserved'],
    ["the name TableColumn", "Def TableColumn\n  Box", 'Line 1: Macro name "TableColumn" is reserved'],
    ["the name Def", "Def Def\n  Box", 'Line 1: Macro name "Def" is reserved'],
    ["a duplicate macro", "Def A\n  Box\nDef A\n  Box", 'Line 3: Duplicate macro "A"'],
    ["a parameter without $", "Def A label\n  Box", `Line 1: Invalid parameter "label" ${expectedParam}`],
    ["a parameter starting with a digit", "Def A $1a\n  Box", `Line 1: Invalid parameter "$1a" ${expectedParam}`],
    ["a double space between parameters", "Def A $a  $b\n  Box", `Line 1: Invalid parameter "" ${expectedParam}`],
    ["a duplicate parameter", "Def A $a $a\n  Box", 'Line 1: Duplicate parameter "$a"'],
    ["an empty body", 'Def A $a\nPage "P"', 'Line 1: Macro "A" has an empty body'],
    ["a body of blank lines", "Def A\n\n  \n", 'Line 1: Macro "A" has an empty body'],
    ["an undeclared parameter", 'Def A $a\n  Box\n  Text "$b"', 'Line 3: Unknown parameter "$b" in macro "A"'],
    ["an undeclared parameter in an attribute", "Def A\n  Box font=$f", 'Line 2: Unknown parameter "$f" in macro "A"'],
    ["a missing argument", 'Def A $a $b\n  Box\nPage "P"\n  A a=1', 'Line 4: Missing argument "b" for macro "A"'],
    ["an unknown argument", 'Def A $a\n  Box\nPage "P"\n  A a=1 b=2', 'Line 4: Unknown argument "b" for macro "A"'],
    ["a duplicate argument", 'Def A $a\n  Box\nPage "P"\n  A a=1 a=2', 'Line 4: Duplicate argument "a"'],
    ["a second unlabeled argument", 'Def A $a\n  Text "$1"\nPage "P"\n  A "x" a=1 "y"', 'Line 4: Invalid argument ""y"" (expected name=value or name="value")'],
    ["an unlabeled argument after a named one", 'Def A $a\n  Text "$1"\nPage "P"\n  A a=1 "y"', 'Line 4: Invalid argument ""y"" (expected name=value or name="value")'],
    ["an unlabeled argument for a macro without $1", 'Def A $a\n  Box\nPage "P"\n  A a', 'Line 4: Unexpected positional argument for macro "A"'],
    ["a quoted unlabeled argument for a macro without $1", 'Def A\n  Box\nPage "P"\n  A "x"', 'Line 4: Unexpected positional argument for macro "A"'],
    ["a missing unlabeled argument", 'Def A\n  Text "$1"\nPage "P"\n  A', 'Line 4: Missing positional argument for macro "A"'],
    ["a missing unlabeled argument with named ones given", 'Def A $a\n  Text "$1 $a"\nPage "P"\n  A a=1', 'Line 4: Missing positional argument for macro "A"'],
    ["$1 declared as a parameter", 'Def A $1\n  Text "$1"', `Line 1: Invalid parameter "$1" ${expectedParam}`],
    ["an argument named 1", 'Def A\n  Text "$1"\nPage "P"\n  A "x" 1=y', 'Line 4: Unknown argument "1" for macro "A"'],
    ["an unterminated quote", 'Def A $a\n  Box\nPage "P"\n  A a="x y', 'Line 4: Invalid argument "a="x" (expected name=value or name="value")'],
    ["text after a quoted argument", 'Def A $a\n  Box\nPage "P"\n  A a="x"y', 'Line 4: Invalid argument "a="x"y" (expected name=value or name="value")'],
    ["a double space between arguments", 'Def A $a $b\n  Box\nPage "P"\n  A a=1  b=2', 'Line 4: Invalid argument "" (expected name=value or name="value")'],
    ["a macro with children", 'Def A\n  Box\nPage "P"\n  A\n    Box', 'Line 4: Macro "A" cannot have children'],
  ];

  for (const [name, source, message] of cases) {
    it(`reports ${name}`, () => {
      expect(errorOf(source)).toBe(message);
    });
  }

  it("fails on the first error", () => {
    expect(errorOf("Def a\n  Box\nDef B\n")).toBe('Line 1: Invalid macro name "a" (expected Pascal case)');
  });

  it("reports an error in a nested use at the line of the outer use", () => {
    const source = 'Def A $x\n  Box\nDef B\n  A\nPage "P"\n  B';
    expect(errorOf(source)).toBe('Line 6: Missing argument "x" for macro "A"');
  });

  it("has no error that a parameter can only be used as text", () => {
    expect(errorOf('Def A $a\n  Box font=$a\nPage "P"\n  A a=bold')).toBeUndefined();
  });

  it("leaves a wrongly indented body line for the core parser", () => {
    expect(expand('Def A\n Box\nPage "P"\n  A').source).toBe('Page "P"\n   Box');
    expect(errorOf('Def A\n  Box\n\tBox')).toBeUndefined();
  });
});

describe("pointer arguments", () => {
  const fieldDef = `Def Field $field=label|mockValues
  Text "$field.label"
  Box "$field.mockValues"
`;
  const invalid = (token: string) =>
    `Invalid pointer "${token}" (expected @Entity.Field or @Entity.Field.<entity|field|dataType|label|mock>)`;
  const mustNameField = (token: string) => `Pointer "${token}" must name a field (expected @Entity.Field)`;
  const column = "(expected entity, field, dataType, label or mockValues)";

  it("still accepts the old column name mockValue, as the mockValues column", () => {
    const old = 'Def Field $field=label|mockValue\n  Text "$field.label"\n  Box "$field.mockValue"\nPage "P"\n';
    expect(expand(`${old}  Field field=@User.FirstName`).source).toBe(
      expand(`${fieldDef}Page "P"\n  Field field=@User.FirstName`).source,
    );
  });

  describe("for a plain parameter", () => {
    const label = 'Def Label $text\n  Text "$text"\nPage "P"\n';

    it("substitutes a bare pointer as the value and drops the quotes the body put around it", () => {
      expect(expand(`${label}  Label text=@User.FirstName`).source).toBe('Page "P"\n  Text @User.FirstName');
      expect(expand(`${label}  Label text=@User.FirstName.label`).source).toBe(
        'Page "P"\n  Text @User.FirstName.label',
      );
    });

    it("keeps a quoted argument a literal, even when it starts with @", () => {
      expect(expand(`${label}  Label text="@User.FirstName"`).source).toBe('Page "P"\n  Text "@User.FirstName"');
      expect(expand(`${label}  Label text="@home"`).source).toBe('Page "P"\n  Text "@home"');
    });

    it("reports a bare argument that starts with @ and is not a valid pointer", () => {
      expect(errorOf(`${label}  Label text=@home`)).toBe(`Line 4: ${invalid("@home")}`);
      expect(errorOf(`${label}  Label text=@user.FirstName`)).toBe(`Line 4: ${invalid("@user.FirstName")}`);
      expect(errorOf(`${label}  Label text=@User.FirstName.value`)).toBe(
        `Line 4: ${invalid("@User.FirstName.value")}`,
      );
    });

    it("reports an entity pointer as needing a field", () => {
      expect(errorOf(`${label}  Label text=@User`)).toBe(`Line 4: ${mustNameField("@User")}`);
    });

    it("keeps a pointer that is not the whole content of the quotes as literal text", () => {
      const source = 'Def Label $text\n  Text "Name: $text"\nPage "P"\n  Label text=@User.FirstName.label';
      expect(expand(source).source).toBe('Page "P"\n  Text "Name: @User.FirstName.label"');
    });

    it("keeps a literal expanding as before, with its quotes", () => {
      expect(expand(`${label}  Label text="Hi there"`).source).toBe('Page "P"\n  Text "Hi there"');
      expect(expand(`${label}  Label text=Hi`).source).toBe('Page "P"\n  Text "Hi"');
    });

    it("keeps a pointer followed by .x in quotes a literal, as the dot stays text", () => {
      const source = 'Def A $text\n  Text "$text.x"\nPage "P"\n  A text=@User.FirstName';
      expect(expand(source).source).toBe('Page "P"\n  Text "@User.FirstName.x"');
    });

    it("also applies to the unlabeled argument", () => {
      const title = 'Def T\n  Text "$1" font=bold\nPage "P"\n';
      expect(expand(`${title}  T @User.FirstName.label`).source).toBe(
        'Page "P"\n  Text @User.FirstName.label font=bold',
      );
      expect(expand(`${title}  T "@User.FirstName"`).source).toBe('Page "P"\n  Text "@User.FirstName" font=bold');
      expect(errorOf(`${title}  T @nope`)).toBe(`Line 4: ${invalid("@nope")}`);
    });

    it("passes a pointer on to a nested macro, quoted or not", () => {
      for (const pass of ["label=$f", 'label="$f"']) {
        const source = `Def Inner $label\n  Text "$label"\nDef Outer $f\n  Inner ${pass}\nPage "P"\n  Outer f=@User.FirstName`;
        expect(expand(source).source).toBe('Page "P"\n  Text @User.FirstName');
      }
    });
  });

  describe("for an object parameter", () => {
    it("fills each declared field from the column of the same name", () => {
      expect(expand(`${fieldDef}Page "P"\n  Field field=@User.FirstName`).source).toBe(
        'Page "P"\n  Text @User.FirstName.label\n  Box @User.FirstName.mock',
      );
    });

    it("fills entity, field, dataType, label and mockValues", () => {
      const source = `Def Col $f=entity|field|dataType|label|mockValues
  Text "$f.entity"
  Text "$f.field"
  Text "$f.dataType"
  Text "$f.label"
  Text "$f.mockValues"
Page "P"
  Col f=@User.Age`;
      expect(expand(source).source).toBe(
        [
          'Page "P"',
          "  Text @User.Age.entity",
          "  Text @User.Age.field",
          "  Text @User.Age.dataType",
          "  Text @User.Age.label",
          "  Text @User.Age.mock",
        ].join("\n"),
      );
    });

    it("fills only the declared fields, in any order, with other parameters", () => {
      const source = `Def Row3 $title $f=mockValues|label
  Text "$title: $f.label"
  Box "$f.mockValues"
Page "P"
  Row3 title="T" f=@User.Age`;
      expect(expand(source).source).toBe('Page "P"\n  Text "T: @User.Age.label"\n  Box @User.Age.mock');
    });

    it("keeps a placeholder with other text around it in quotes a literal", () => {
      const source = `Def A $f=label
  Text "Name: $f.label"
Page "P"
  A f=@User.FirstName`;
      expect(expand(source).source).toBe('Page "P"\n  Text "Name: @User.FirstName.label"');
    });

    it("treats a quoted pointer as a literal single value", () => {
      const one = 'Def A $f=label\n  Text "$f.label"\nPage "P"\n  A f="@User.FirstName"';
      expect(expand(one).source).toBe('Page "P"\n  Text "@User.FirstName"');
      expect(errorOf(`${fieldDef}Page "P"\n  Field field="@User.FirstName"`)).toBe(
        'Line 5: Parameter "field" expects 2 values but got 1',
      );
    });

    it("accepts a pointer for one field written dotted, and a literal for another", () => {
      const source = `${fieldDef}Page "P"\n  Field field.label=@User.FirstName.label field.mockValues="x"`;
      expect(expand(source).source).toBe('Page "P"\n  Text @User.FirstName.label\n  Box "x"');
    });

    it("leaves the piped form always literal, even for a bare value that starts with @", () => {
      const source = `Def C $item=x|y
  Text "$item.x"
  Text "$item.y"
Page "P"
  C item=@a|b`;
      expect(expand(source).source).toBe('Page "P"\n  Text "@a"\n  Text "b"');
      expect(expand(`${fieldDef}Page "P"\n  Field field="Hi"|"Text"`).source).toBe(
        'Page "P"\n  Text "Hi"\n  Box "Text"',
      );
    });

    it("reports a declared field that is not a data dictionary column", () => {
      const source = 'Def X $item=title|label\n  Box "$item.title"\nPage "P"\n  X item=@User.FirstName';
      expect(errorOf(source)).toBe(
        `Line 4: Field "title" of parameter "$item" is not a data dictionary column ${column}`,
      );
    });

    it("reports an entity pointer, a pointer with a column and an invalid pointer", () => {
      expect(errorOf(`${fieldDef}Page "P"\n  Field field=@User`)).toBe(`Line 5: ${mustNameField("@User")}`);
      expect(errorOf(`${fieldDef}Page "P"\n  Field field=@User.FirstName.label`)).toBe(
        `Line 5: ${mustNameField("@User.FirstName.label")}`,
      );
      expect(errorOf(`${fieldDef}Page "P"\n  Field field=@bad`)).toBe(`Line 5: ${invalid("@bad")}`);
    });

    it("reports a field given both from a pointer and dotted as a duplicate", () => {
      expect(errorOf(`${fieldDef}Page "P"\n  Field field=@User.FirstName field.label="x"`)).toBe(
        'Line 5: Duplicate argument "field.label"',
      );
    });

    it("reports a pointer used by a nested macro at the line of the outer use", () => {
      const source = `${fieldDef}Def Outer $f\n  Field field=$f\nPage "P"\n  Outer f=@bad`;
      expect(errorOf(source)).toBe(`Line 7: ${invalid("@bad")}`);
    });
  });
});

describe("list parameters", () => {
  const list = 'Def List $items\n  Each $items as=item\n    Text "$item"\nPage "P"\n  ';
  const texts = (...items: string[]) => `Page "P"${items.map((item) => `\n  Text ${item}`).join("")}`;
  const listOf = (arg: string) => expand(`${list}List ${arg}`).source;
  const invalidArgument = (token: string) => `Invalid argument "${token}" (expected name=value or name="value")`;

  describe("parsing", () => {
    it("takes quoted elements with spaces", () => {
      expect(listOf('items="item 1","item 2","item 3"')).toBe(texts('"item 1"', '"item 2"', '"item 3"'));
    });

    it("takes bare elements", () => {
      expect(listOf("items=a,b,c")).toBe(texts('"a"', '"b"', '"c"'));
    });

    it("takes quoted and bare elements mixed", () => {
      expect(listOf('items=a,"b c",d')).toBe(texts('"a"', '"b c"', '"d"'));
    });

    it("keeps , and | inside a quoted element", () => {
      expect(listOf('items="a,b","c|d",e')).toBe(texts('"a,b"', '"c|d"', '"e"'));
    });

    it("takes a single value as a list of one, quoted or bare", () => {
      expect(listOf("items=a")).toBe(texts('"a"'));
      expect(listOf('items="a b"')).toBe(texts('"a b"'));
    });

    it("takes an empty quoted element", () => {
      expect(listOf('items="",a,""')).toBe(texts('""', '"a"', '""'));
    });

    it("takes a bare element that starts with @ as a pointer and a quoted one as a literal", () => {
      expect(listOf('items=@User.A,"@User.B",@User.C.label')).toBe(
        texts("@User.A", '"@User.B"', "@User.C.label"),
      );
    });

    it("reports a bare element that starts with @ and is not a pointer", () => {
      expect(errorOf(`${list}List items=a,@home`)).toBe('Line 5: Invalid pointer "@home" (expected @Entity.Field or @Entity.Field.<entity|field|dataType|label|mock>)');
    });

    it("also applies to the unlabeled argument $1", () => {
      const source = 'Def L\n  Each $1 as=i\n    Text "$i"\nPage "P"\n  ';
      expect(expand(`${source}L a,"b c",@User.D`).source).toBe(texts('"a"', '"b c"', "@User.D"));
      expect(expand(`${source}L "x"`).source).toBe(texts('"x"'));
    });

    it("takes a list for $1 beside named arguments", () => {
      const source = 'Def L $font\n  Each $1 as=i\n    Text "$i" font=$font\nPage "P"\n  L a,b font=bold';
      expect(expand(source).source).toBe('Page "P"\n  Text "a" font=bold\n  Text "b" font=bold');
    });

    it("now splits a bare value on a comma, and keeps it when quoted", () => {
      const source = 'Def A $note\n  Each $note as=n\n    Text "$n"\nPage "P"\n  ';
      expect(expand(`${source}A note=a,b`).source).toBe(texts('"a"', '"b"'));
      expect(expand(`${source}A note="a,b"`).source).toBe(texts('"a,b"'));
    });

    it("keeps a dotted object field a single value, with a comma as text", () => {
      const source = 'Def A $item=title|id\n  Text "$item.title"\nPage "P"\n  A item.title=a,b item.id=1';
      expect(expand(source).source).toBe(texts('"a,b"'));
    });

    it("expands a source without lists exactly as before", () => {
      const source = 'Def A $x\n  Text "$x"\nPage "P"\n  A x=a';
      expect(expand(source).source).toBe(texts('"a"'));
      expect(expand('Page "P"\n  Box').source).toBe('Page "P"\n  Box');
    });
  });

  describe("Each", () => {
    it("repeats its children at its own indentation, once per element, and produces no line of its own", () => {
      const source = 'Def List $items\n  Box\n    Each $items as=item\n      Text "$item"\nPage "P"\n  Box\n    List items=a,b';
      expect(expand(source).source).toBe('Page "P"\n  Box\n    Box\n      Text "a"\n      Text "b"');
    });

    it("repeats several first-level children in order, with lines before and after it", () => {
      const source = `Def A $items
  Text "head"
  Each $items as=item
    Text "$item"
    Spacer
  Text "foot"
Page "P"
  A items=a,b`;
      expect(expand(source).source).toBe('Page "P"\n  Text "head"\n  Text "a"\n  Spacer\n  Text "b"\n  Spacer\n  Text "foot"');
    });

    it("repeats children that have children of their own", () => {
      const source = 'Def A $items\n  Each $items as=item\n    Box\n      Text "$item"\nPage "P"\n  A items=a,b';
      expect(expand(source).source).toBe('Page "P"\n  Box\n    Text "a"\n  Box\n    Text "b"');
    });

    it("uses the loop variable anywhere a $name may appear", () => {
      const source = 'Def A $items\n  Each $items as=t\n    $t "$t" $t=$t\nPage "P"\n  A items=Box,Text';
      expect(expand(source).source).toBe('Page "P"\n  Box "Box" Box=Box\n  Text "Text" Text=Text');
    });

    it("loops over $1", () => {
      expect(expand('Def L\n  Each $1 as=i\n    Text "$i"\nPage "P"\n  L a,b').source).toBe(texts('"a"', '"b"'));
    });

    it("runs once for a single value", () => {
      expect(listOf("items=only")).toBe(texts('"only"'));
    });

    it("nests over different parameters", () => {
      const source = `Def Grid $rows $cols
  Each $rows as=r
    BoxRow
      Each $cols as=c
        Text "$r-$c"
Page "P"
  Grid rows=a,b cols=1,2`;
      expect(expand(source).source).toBe(
        'Page "P"\n  BoxRow\n    Text "a-1"\n    Text "a-2"\n  BoxRow\n    Text "b-1"\n    Text "b-2"',
      );
    });

    it("uses both loop variables of a nested Each, and an outer one after the inner Each", () => {
      const source = `Def Grid $rows $cols
  Each $rows as=r
    Each $cols as=c
      Text "$r$c"
    Text "end $r"
Page "P"
  Grid rows=a,b cols=1,2`;
      expect(expand(source).source).toBe(texts('"a1"', '"a2"', '"end a"', '"b1"', '"b2"', '"end b"'));
    });

    it("allows the same loop variable name in sibling Eachs", () => {
      const source = 'Def A $x $y\n  Each $x as=i\n    Text "$i"\n  Each $y as=i\n    Box "$i"\nPage "P"\n  A x=1,2 y=3';
      expect(expand(source).source).toBe('Page "P"\n  Text "1"\n  Text "2"\n  Box "3"');
    });

    it("expands macro uses inside an Each and passes the element on", () => {
      const source = `Def Item $label
  Text "$label" font=bold
Def Menu $items
  Box
    Each $items as=item
      Item label="$item"
Page "P"
  Menu items="a b",c`;
      expect(expand(source).source).toBe('Page "P"\n  Box\n    Text "a b" font=bold\n    Text "c" font=bold');
    });

    it("passes a pointer element on, with or without the quotes of the body", () => {
      const source = `Def Item $label
  Text "$label"
Def Menu $items
  Each $items as=item
    Item label="$item"
    Item label=$item
Page "P"
  Menu items=@User.A,"@User.B"`;
      expect(expand(source).source).toBe(
        texts("@User.A", "@User.A", '"@User.B"', '"@User.B"'),
      );
    });

    it("keeps core lines and macro uses together, each repeat nested at the use's indentation", () => {
      const source = `Def Item $label
  Text "$label"
Def Menu $items
  Each $items as=item
    BoxRow
      Item label=$item
Page "P"
  Box
    Menu items=a,b`;
      expect(expand(source).source).toBe(
        'Page "P"\n  Box\n    BoxRow\n      Text "a"\n    BoxRow\n      Text "b"',
      );
    });

    it("reports every repeated line at the use, with the macro", () => {
      const source = 'Def List $items\n  Each $items as=item\n    Text "$item"\nPage "P"\n  List items=a,b\n  Box';
      expect(expand(source).origins).toEqual([
        { line: 4 },
        { line: 5, macro: "List" },
        { line: 5, macro: "List" },
        { line: 6 },
      ]);
    });

    it("has a loop variable that only exists inside its Each", () => {
      const source = 'Def A $x\n  Each $x as=i\n    Text "$i"\n  Text "$x"\nPage "P"\n  A x=v';
      expect(expand(source).source).toBe(texts('"v"', '"v"'));
    });

    it("keeps $name that is not a loop variable inside an Each as the parameter", () => {
      const source = 'Def A $items $label\n  Each $items as=item\n    Text "$label $item"\nPage "P"\n  A items=1,2 label=n';
      expect(expand(source).source).toBe(texts('"n 1"', '"n 2"'));
    });
  });

  describe("lists of objects", () => {
    const cards = `Def Cards $items=title|description
  Each $items as=card
    Box
      Text "$card.title" font=bold
      Text "$card.description"
Page "P"
  `;
    const card = (title: string, description: string) =>
      `\n  Box\n    Text ${title} font=bold\n    Text ${description}`;

    it("repeats once per record of the piped form", () => {
      expect(expand(`${cards}Cards items="A"|"a text","B"|"b text"`).source).toBe(
        `Page "P"${card('"A"', '"a text"')}${card('"B"', '"b text"')}`,
      );
    });

    it("takes bare and quoted values and a comma inside quotes in a record", () => {
      expect(expand(`${cards}Cards items=A|"a, b",B|c`).source).toBe(
        `Page "P"${card('"A"', '"a, b"')}${card('"B"', '"c"')}`,
      );
    });

    it("works with one record, piped or dotted", () => {
      const expected = `Page "P"${card('"A"', '"a text"')}`;
      expect(expand(`${cards}Cards items="A"|"a text"`).source).toBe(expected);
      expect(expand(`${cards}Cards items.title=A items.description="a text"`).source).toBe(expected);
    });

    it("keeps the dotted form a single record, with a comma as text", () => {
      expect(expand(`${cards}Cards items.title=a,b items.description=c`).source).toBe(
        `Page "P"${card('"a,b"', '"c"')}`,
      );
    });

    it("uses one record's field without an Each", () => {
      const source = 'Def A $item=title|id\n  Text "$item.title $item.id"\nPage "P"\n  A item="Hi"|"1"';
      expect(expand(source).source).toBe(texts('"Hi 1"'));
    });

    it("loops over a record list with a record of one field", () => {
      const source = 'Def A $items=name\n  Each $items as=i\n    Text "$i.name"\nPage "P"\n  A items=x,y';
      expect(expand(source).source).toBe(texts('"x"', '"y"'));
    });

    it("repeats a pointer record once", () => {
      const source = 'Def A $items=label|mockValues\n  Each $items as=i\n    Text "$i.label"\n    Box "$i.mockValues"\nPage "P"\n  A items=@User.Name';
      expect(expand(source).source).toBe('Page "P"\n  Text @User.Name.label\n  Box @User.Name.mock');
    });

    it("reports a record with the wrong number of values", () => {
      expect(errorOf(`${cards}Cards items="A"|"a","B"`)).toBe('Line 7: Parameter "items" expects 2 values but got 1');
      expect(errorOf(`${cards}Cards items="A"|"a"|"x","B"|"b"`)).toBe(
        'Line 7: Parameter "items" expects 2 values but got 3',
      );
    });

    it("reports a bare loop variable and an undeclared field, as for any object", () => {
      expect(errorOf('Def A $items=t\n  Each $items as=card\n    Text "$card"')).toBe(
        'Line 3: Parameter "$card" is an object (use $card.<field>)',
      );
      expect(errorOf('Def A $items=t\n  Each $items as=card\n    Text "$card.x"')).toBe(
        'Line 3: Unknown field "x" on parameter "$card"',
      );
    });

    it("reports more than one record used outside an Each", () => {
      const source = 'Def A $items=t|d\n  Text "$items.t"\nPage "P"\n  A items=a|b,c|d';
      expect(errorOf(source)).toBe('Line 4: Argument "items" is a list (use it in an Each)');
    });
  });

  describe("passing a list on", () => {
    const chain = `Def Inner $items
  Each $items as=item
    Text "$item"
Def Outer $items
  Inner items=$items
Def Outermost $items
  Outer items=$items
Page "P"
  `;

    it("keeps all its values through one macro", () => {
      expect(expand(`${chain}Outer items="a b",c,d`).source).toBe(texts('"a b"', '"c"', '"d"'));
    });

    it("keeps all its values through several macros", () => {
      expect(expand(`${chain}Outermost items="a b",c,d`).source).toBe(texts('"a b"', '"c"', '"d"'));
    });

    it("keeps a single value that has a space", () => {
      expect(expand(`${chain}Outermost items="a b"`).source).toBe(texts('"a b"'));
    });

    it("keeps pointers as pointers and quoted values as literals", () => {
      expect(expand(`${chain}Outermost items=@User.A,"@User.B"`).source).toBe(texts("@User.A", '"@User.B"'));
    });

    it("passes the unlabeled argument on", () => {
      const source = 'Def Inner $items\n  Each $items as=i\n    Text "$i"\nDef Outer\n  Inner items=$1\nPage "P"\n  Outer "a b",c';
      expect(expand(source).source).toBe(texts('"a b"', '"c"'));
    });

    it("hands on a parameter beside other arguments, and leaves a quoted $name alone", () => {
      const source = `Def Inner $label $items
  Text "$label"
  Each $items as=item
    Text "$item"
Def Outer $x $items
  Inner label="a x=$x b" items=$items
Page "P"
  Outer x=Z items=1,2`;
      expect(expand(source).source).toBe(texts('"a x=Z b"', '"1"', '"2"'));
    });

    it("does not substitute a $name inside a value that is handed on", () => {
      const source = 'Def Inner $items\n  Each $items as=i\n    Text "$i"\nDef Outer $items $b\n  Inner items=$items\nPage "P"\n  Outer items="$b",x b=y';
      expect(expand(source).source).toBe(texts('"$b"', '"x"'));
    });

    it("can also pass a list on with a loop variable inside quotes as one value", () => {
      const source = 'Def Inner $items\n  Each $items as=i\n    Text "$i"\nDef Outer $groups\n  Each $groups as=g\n    Inner items="$g"\nPage "P"\n  Outer groups=a,b';
      expect(expand(source).source).toBe(texts('"a"', '"b"'));
    });

    it("reports a list that a macro body uses outside an Each, at the line of the use", () => {
      const source = 'Def Inner $items\n  Text "$items"\nDef Outer $items\n  Inner items=$items\nPage "P"\n  Outer items=a,b';
      expect(errorOf(source)).toBe('Line 6: Argument "items" is a list (use it in an Each)');
    });
  });

  describe("reserved name", () => {
    it("does not allow Each as a macro name", () => {
      expect(errorOf("Def Each\n  Box")).toBe('Line 1: Macro name "Each" is reserved');
    });
  });

  describe("Table and TableColumn", () => {
    it("are reserved names in a source and in the shared macros", () => {
      expect(errorOf("Def Table\n  Box")).toBe('Line 1: Macro name "Table" is reserved');
      expect(errorOf("Def TableColumn\n  Box")).toBe('Line 1: Macro name "TableColumn" is reserved');
      expect(errorOf2('Page "P"', "Def Table\n  Box")).toBe('Macros: Line 1: Macro name "Table" is reserved');
      expect(errorOf2('Page "P"', "Def TableColumn\n  Box")).toBe(
        'Macros: Line 1: Macro name "TableColumn" is reserved',
      );
    });

    it("are not read as a macro use, so their lines pass through untouched", () => {
      const source = `Def Col $text\n  Box "$text"\nPage "P"\n  Table\n    TableColumn "A"|"1","2" width=3\n    Col text="x"\n`;
      const result = expand(source);
      expect(result.source).toBe(`Page "P"\n  Table\n    TableColumn "A"|"1","2" width=3\n    Box "x"\n`);
    });

    it("pass through a source with no macros as it was written", () => {
      const source = 'Page "P"\n  Table\n    TableColumn @User.Name\n    TableColumn "A"|"1"';
      expect(expand(source).source).toBe(source);
    });
  });

  describe("errors", () => {
    const invalidEach = (text: string) => `Invalid Each "${text}" (expected Each $param as=name)`;
    const cases: [string, string, string][] = [
      ["an Each with nothing after it", "Def A $x\n  Each\n    Box", `Line 2: ${invalidEach("")}`],
      ["an Each without as=", "Def A $x\n  Each $x\n    Box", `Line 2: ${invalidEach("$x")}`],
      ["an Each without a $param", "Def A $x\n  Each x as=i\n    Box", `Line 2: ${invalidEach("x as=i")}`],
      ["an Each whose name starts with a digit", "Def A $x\n  Each $x as=1a\n    Box", `Line 2: ${invalidEach("$x as=1a")}`],
      ["an Each with an empty name", "Def A $x\n  Each $x as=\n    Box", `Line 2: ${invalidEach("$x as=")}`],
      ["an Each with extra tokens", "Def A $x\n  Each $x as=i extra\n    Box", `Line 2: ${invalidEach("$x as=i extra")}`],
      ["an Each with a double space", "Def A $x\n  Each $x  as=i\n    Box", `Line 2: ${invalidEach("$x  as=i")}`],
      ["an Each with a field", "Def A $x\n  Each $x.a as=i\n    Box", `Line 2: ${invalidEach("$x.a as=i")}`],
      ["an Each with no children", 'Def A $x\n  Each $x as=i\n  Box', 'Line 2: Each in macro "A" has no children'],
      ["an Each that ends the body", "Def A $x\n  Box\n  Each $x as=i", 'Line 3: Each in macro "A" has no children'],
      [
        "an Each whose children are in the line after a sibling",
        'Def A $x $y\n  Each $x as=i\n    Each $y as=j\n    Box',
        'Line 3: Each in macro "A" has no children',
      ],
      ["a loop variable that is a parameter", "Def A $x\n  Each $x as=x\n    Box", 'Line 2: Name "x" is already used in macro "A"'],
      ["a loop variable that is another parameter", "Def A $x $y\n  Each $x as=y\n    Box", 'Line 2: Name "y" is already used in macro "A"'],
      [
        "a loop variable of an enclosing Each",
        "Def A $x $y\n  Each $x as=i\n    Each $y as=i\n      Box",
        'Line 3: Name "i" is already used in macro "A"',
      ],
      ["a looped parameter that is not declared", "Def A\n  Each $x as=i\n    Box", 'Line 2: Unknown parameter "$x" in macro "A"'],
      [
        "a loop variable used after its Each",
        'Def A $x\n  Each $x as=i\n    Box\n  Text "$i"',
        'Line 4: Unknown parameter "$i" in macro "A"',
      ],
      [
        "a loop variable used in a sibling Each",
        'Def A $x $y\n  Each $x as=i\n    Box\n  Each $y as=j\n    Text "$i"',
        'Line 5: Unknown parameter "$i" in macro "A"',
      ],
      [
        "an Each over a loop variable",
        "Def A $x\n  Each $x as=i\n    Each $i as=j\n      Box",
        'Line 3: Unknown parameter "$i" in macro "A"',
      ],
      ["a list used outside an Each", 'Def A $x\n  Text "$x"\nPage "P"\n  A x=a,b', 'Line 4: Argument "x" is a list (use it in an Each)'],
      ["a list used as an attribute", 'Def A $x\n  Box font=$x\nPage "P"\n  A x=a,b', 'Line 4: Argument "x" is a list (use it in an Each)'],
      ["a list in $1 used outside an Each", 'Def A\n  Text "$1"\nPage "P"\n  A a,b', 'Line 4: Argument "1" is a list (use it in an Each)'],
      ["an Each outside a Def", 'Page "P"\n  Each $x as=i\n    Box', "Line 2: Each can only be used in a macro body"],
      ["an Each at the root", "Each $x as=i", "Line 1: Each can only be used in a macro body"],
      ["an Each after a Def", "Def A\n  Box\nEach", "Line 3: Each can only be used in a macro body"],
      ["an empty element in the middle", "Def A $x\n  Box\nPage \"P\"\n  A x=a,,b", `Line 4: ${invalidArgument("x=a,,b")}`],
      ["an empty last element", 'Def A $x\n  Box\nPage "P"\n  A x=a,', `Line 4: ${invalidArgument("x=a,")}`],
      ["an empty first element", 'Def A $x\n  Box\nPage "P"\n  A x=,a', `Line 4: ${invalidArgument("x=,a")}`],
      ["an empty element after a quoted one", 'Def A $x\n  Box\nPage "P"\n  A x="a",,b', `Line 4: ${invalidArgument('x="a",,b')}`],
      ["text after a quoted element", 'Def A $x\n  Box\nPage "P"\n  A x="a"b,c', `Line 4: ${invalidArgument('x="a"b,c')}`],
      ["an empty element of a record list", 'Def A $x=a|b\n  Box\nPage "P"\n  A x=1|2,,3|4', `Line 4: ${invalidArgument("x=1|2,,3|4")}`],
      ["a trailing comma in a record list", 'Def A $x=a|b\n  Box\nPage "P"\n  A x=1|2,', `Line 4: ${invalidArgument("x=1|2,")}`],
      ["an empty element in $1", 'Def A\n  Text "$1"\nPage "P"\n  A a,,b', `Line 4: ${invalidArgument("a,,b")}`],
    ];

    for (const [name, source, message] of cases) {
      it(`reports ${name}`, () => {
        expect(errorOf(source)).toBe(message);
      });
    }

    it("reports an Each error in a Def at the line of the Each, even when the Def is long", () => {
      expect(errorOf('Page "P"\n  Box\nDef A $x\n  Box\n  Text "a"\n  Each $x as=i')).toBe(
        'Line 6: Each in macro "A" has no children',
      );
    });

    it("reports an Each in the shared text only when it is in a Def", () => {
      expect(errorOf2('Page "P"', 'Page "x"\n  Each $a as=b\n    Box')).toBeUndefined();
      expect(errorOf2('Page "P"', "Def A\n  Each $x as=i\n    Box")).toBe(
        'Macros: Line 2: Unknown parameter "$x" in macro "A"',
      );
    });
  });
});

describe("comments", () => {
  it("does not end a Def body and is not part of it", () => {
    const source = 'Def A\n  Box\n# note\n  Text "x"\nPage "P"\n  A';
    const result = expand(source);
    expect(result.source).toBe('Page "P"\n  Box\n  Text "x"');
  });

  it("keeps a comment after a Def body and before its use as a comment line", () => {
    const result = expand('Def A\n  Box\n# between\nPage "P"\n# before use\n  A\n');
    expect(result.source).toBe('# between\nPage "P"\n# before use\n  Box\n');
    expect(result.origins[0]).toEqual({ line: 3 });
    expect(result.origins[2]).toEqual({ line: 5 });
    expect(result.origins[3]).toEqual({ line: 6, macro: "A" });
  });

  it("is never taken for a Def or a macro use", () => {
    const source = '# Def A\n#A\n# A x="1"\nPage "P"\n  Box';
    expect(expand(source).source).toBe(source);
    expect(errorOf('Def A\n  Box\n# A\nPage "P"\n  A')).toBeUndefined();
  });

  it("treats an indented # in a body as a body line", () => {
    const result = expand('Def A\n  Box\n    # note\nPage "P"\n  A');
    expect(result.source).toBe('Page "P"\n  Box\n    # note');
  });

  it("does not hide a child under a macro use", () => {
    expect(errorOf('Def A\n  Box\nPage "P"\n  A\n# note\n    Box')).toBe('Line 4: Macro "A" cannot have children');
  });

  it("keeps the line numbers of the source as written in errors", () => {
    expect(errorOf('# note\nDef A $x\n# note\n  Box "$x"\n# note\nPage "P"\n# note\n  A')).toBe(
      'Line 8: Missing argument "x" for macro "A"',
    );
    expect(errorOf('# one\n# two\nDef a\n  Box')).toBe('Line 3: Invalid macro name "a" (expected Pascal case)');
  });

  it("returns a source with comments but no Def or macro use as the very same string", () => {
    const source = '# note\nPage "P"\r\n# note\r\n  Box';
    const result = expand(source);
    expect(result.source).toBe(source);
    expect(result.origins).toHaveLength(source.split(/\r?\n/).length);
  });

  it("ignores comments in the shared macros", () => {
    const result = expand2('Page "P"\n  A', '# note\nDef A\n# note\n  Box\n# note');
    expect(result.source).toBe('Page "P"\n  Box');
  });
});
