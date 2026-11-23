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
    for (const name of ["field", "Nav_Tabs", "2Field", "", "Box", "Page", "Def", "Spacer"]) {
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
