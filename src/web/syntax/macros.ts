import { z } from "zod";
import { NodeTypeSchema } from "@/schema/ast";
import { mustNameFieldError, parsePointer, POINTER_COLUMNS } from "@/syntax/pointer";

/**
 * Macro preprocessor: expands `Def` macros into core syntax before the source is parsed.
 * Rules: /capabilities/macros/capability.md.
 */

const RESERVED_NAMES: ReadonlySet<string> = new Set([...NodeTypeSchema.options, "Page", "Def", "Each"]);

export const MacroNameSchema = z
  .string()
  .regex(/^[A-Z][A-Za-z0-9]*$/)
  .refine((name) => !RESERVED_NAMES.has(name));
export const ParamNameSchema = z.string().regex(/^[A-Za-z][A-Za-z0-9_]*$/);
export const FieldNameSchema = z.string().regex(/^[A-Za-z][A-Za-z0-9_]*$/);
export const MacroDefinitionSchema = z.strictObject({
  name: MacroNameSchema,
  params: z.array(ParamNameSchema),
  objects: z.record(ParamNameSchema, z.array(FieldNameSchema).min(1)),
  positional: z.boolean(),
  body: z.array(z.string()).min(1),
});
export type MacroDefinition = z.infer<typeof MacroDefinitionSchema>;

/** Where a line of the expanded text came from: its line in the source as written, and the macro whose body it is. */
export type LineOrigin = { line: number; macro?: string };

export type ExpandResult =
  | { ok: true; source: string; origins: LineOrigin[] }
  | { ok: false; error: string };

const BODY_INDENT = "  ";
/** The key of the unlabeled argument (`$1`) in the stored arguments; named parameters can never be called this. */
const POSITIONAL = "1";
const PARAM_REFERENCE = /\$(1(?![A-Za-z0-9_])|[A-Za-z][A-Za-z0-9_]*)(?:\.([A-Za-z][A-Za-z0-9_]*))?/g;
const QUOTED_PARAM_REFERENCE = new RegExp(`"${PARAM_REFERENCE.source}"`, "g");
/** From the name of a data dictionary column to the suffix of the pointer that reads it. */
const COLUMN_KINDS: ReadonlyMap<string, string> = new Map(
  Object.entries(POINTER_COLUMNS).map(([kind, column]) => [column, kind]),
);
const COLUMN_NAMES = [...COLUMN_KINDS.keys()];
const ARGUMENT_KEY = /([^ "=]+)=/y;
/** One value that is not split on a comma: the field of an object parameter written dotted. */
const SINGLE_VALUE = /(?:"([^"]*)"|([^ "]+))(?= |$)/y;
const LIST_ELEMENT = /(?:"([^"]*)"|([^ ",]+))(?=[ ,]|$)/y;
const PIPED_ELEMENT = /(?:"([^"]*)"|([^ ",|]+))(?=[ ,|]|$)/y;
const POSITIONAL_ELEMENT = /(?:"([^"]*)"|([^ "=,]+))(?=[ ,]|$)/y;
const DEF_LINE = /^Def(?: |$)/;
const INDENTED_DEF_LINE = /^ +Def(?: |$)/;
const EACH_WORD = /^ *Each(?: |$)/;
const EACH_LINE = /^Each \$(1|[A-Za-z][A-Za-z0-9_]*) as=([A-Za-z][A-Za-z0-9_]*)$/;
/** A quoted string (skipped), or `key=$name` with a bare parameter as the whole value of an argument. */
const WHOLE_ARGUMENT = /"[^"]*"|(?<=^| )([^ "=]+)=\$(1|[A-Za-z][A-Za-z0-9_]*)(?= |$)/g;
/** Stands for the written form of an argument until the rest of the line is substituted, which must not touch it. */
const WRITTEN_PLACEHOLDER = /\u0000(\d+)\u0000/g;

type Registered = { definition: MacroDefinition; scope: Scope };
/** The macros a line may use: the ones defined above it. */
type Scope = ReadonlyMap<string, Registered>;
type Use = { registered: Registered; indent: number; rest: string };
/** A value as written in an argument: without its quotes, and whether it had none (a bare `@...` is a pointer). */
type ArgumentText = { text: string; bare: boolean };
/** One stored value; a pointer is substituted without the quotes the body puts around it. */
type Element = { value: string; pointer: boolean };
/** The elements of an argument (one for a single value) and the text it was written as, to pass it on unchanged. */
type Argument = { elements: Element[]; written: string };
/** The loop variables in force: `name` for a plain element, `name.field` for each field of a record. */
type Loops = ReadonlyMap<string, Element>;

class MacroError extends Error {
  constructor(message: string, line: number) {
    super(`Line ${line}: ${message}`);
  }
}

const indentOf = (text: string) => /^ */.exec(text)![0].length;
const isBlank = (text: string) => text.trim() === "";

function readUse(raw: string, scope: Scope): Use | undefined {
  const indent = indentOf(raw);
  const content = raw.slice(indent).trimEnd();
  const space = content.indexOf(" ");
  const registered = scope.get(space === -1 ? content : content.slice(0, space));
  if (registered === undefined) return undefined;
  return { registered, indent, rest: space === -1 ? "" : content.slice(space) };
}

function readDefinition(lines: string[], start: number, scope: Scope): { registered: Registered; next: number } {
  const line = start + 1;
  const [name = "", ...paramTokens] = lines[start]!.slice("Def ".length).trimEnd().split(" ");
  if (name === "") throw new MacroError("Def requires a name", line);
  if (!MacroNameSchema.safeParse(name).success) {
    throw new MacroError(
      RESERVED_NAMES.has(name)
        ? `Macro name "${name}" is reserved`
        : `Invalid macro name "${name}" (expected Pascal case)`,
      line,
    );
  }
  if (scope.has(name)) throw new MacroError(`Duplicate macro "${name}"`, line);

  const params: string[] = [];
  const objects: Record<string, string[]> = {};
  for (const token of paramTokens) {
    const invalid = () => new MacroError(`Invalid parameter "${token}" (expected $name or $name=field|field)`, line);
    if (!token.startsWith("$")) throw invalid();
    const equals = token.indexOf("=");
    const paramName = token.slice(1, equals === -1 ? undefined : equals);
    if (!ParamNameSchema.safeParse(paramName).success) throw invalid();
    const fields = equals === -1 ? undefined : token.slice(equals + 1).split("|");
    if (fields !== undefined && !fields.every((field) => FieldNameSchema.safeParse(field).success)) throw invalid();

    if (params.includes(paramName)) throw new MacroError(`Duplicate parameter "$${paramName}"`, line);
    const duplicate = fields?.find((field, index) => fields.indexOf(field) !== index);
    if (duplicate !== undefined) {
      throw new MacroError(`Duplicate field "${duplicate}" in parameter "$${paramName}"`, line);
    }
    params.push(paramName);
    if (fields !== undefined) objects[paramName] = fields;
  }

  let next = start + 1;
  while (next < lines.length && (isBlank(lines[next]!) || lines[next]!.startsWith(" "))) next += 1;

  const body: string[] = [];
  const bodyLines: number[] = [];
  for (let index = start + 1; index < next; index += 1) {
    const text = lines[index]!;
    if (isBlank(text)) continue;
    body.push(text.startsWith(BODY_INDENT) ? text.slice(BODY_INDENT.length) : ` ${text.trimStart()}`);
    bodyLines.push(index + 1);
  }
  if (body.length === 0) throw new MacroError(`Macro "${name}" has an empty body`, line);

  const positional = checkBody(name, params, objects, body, bodyLines);
  const definition = MacroDefinitionSchema.parse({ name, params, objects, positional, body });
  return { registered: { definition, scope }, next };
}

/**
 * Checks every `$name` of a body against the parameters and the loop variables in force, and every `Each` line.
 * Returns whether the body uses the unlabeled argument `$1`.
 */
function checkBody(
  macro: string,
  params: readonly string[],
  objects: Readonly<Record<string, string[]>>,
  body: readonly string[],
  bodyLines: readonly number[],
): boolean {
  let positional = false;
  /** The `Each`s the current line is inside, with the fields of the record a loop over an object parameter has. */
  const loops: { indent: number; name: string; fields: readonly string[] | undefined }[] = [];

  body.forEach((text, index) => {
    const line = bodyLines[index]!;
    const indent = indentOf(text);
    while (loops.length > 0 && loops.at(-1)!.indent >= indent) loops.pop();

    if (EACH_WORD.test(text)) {
      const content = text.trimEnd().slice(indent);
      const match = EACH_LINE.exec(content);
      if (match === null) {
        throw new MacroError(`Invalid Each "${content.slice("Each ".length)}" (expected Each $param as=name)`, line);
      }
      const [, param, variable] = match as unknown as [string, string, string];
      if (param === POSITIONAL) {
        positional = true;
      } else if (!params.includes(param)) {
        throw new MacroError(`Unknown parameter "$${param}" in macro "${macro}"`, line);
      }
      if (params.includes(variable) || loops.some((loop) => loop.name === variable)) {
        throw new MacroError(`Name "${variable}" is already used in macro "${macro}"`, line);
      }
      const following = body[index + 1];
      if (following === undefined || indentOf(following) <= indent) {
        throw new MacroError(`Each in macro "${macro}" has no children`, line);
      }
      loops.push({ indent, name: variable, fields: param === POSITIONAL ? undefined : fieldsIn(objects, param) });
      return;
    }

    for (const [, paramName, fieldName] of text.matchAll(PARAM_REFERENCE)) {
      if (paramName === POSITIONAL) {
        positional = true;
        continue;
      }
      const loop = loops.find((candidate) => candidate.name === paramName);
      if (loop === undefined && !params.includes(paramName!)) {
        throw new MacroError(`Unknown parameter "$${paramName}" in macro "${macro}"`, line);
      }
      const fields = loop === undefined ? fieldsIn(objects, paramName!) : loop.fields;
      if (fields === undefined) continue;
      if (fieldName === undefined) {
        throw new MacroError(`Parameter "$${paramName}" is an object (use $${paramName}.<field>)`, line);
      }
      if (!fields.includes(fieldName)) {
        throw new MacroError(`Unknown field "${fieldName}" on parameter "$${paramName}"`, line);
      }
    }
  });
  return positional;
}

const fieldsIn = (objects: Readonly<Record<string, string[]>>, param: string): string[] | undefined =>
  Object.hasOwn(objects, param) ? objects[param] : undefined;

const fieldsOf = (definition: MacroDefinition, param: string): readonly string[] | undefined =>
  Object.hasOwn(definition.objects, param) ? definition.objects[param] : undefined;

/** Reads values separated by `,` (a single value is a list of one), or undefined when one of them is empty or invalid. */
function readList(rest: string, start: number, pattern: RegExp): { elements: ArgumentText[]; end: number } | undefined {
  const elements: ArgumentText[] = [];
  let end = start;
  for (;;) {
    pattern.lastIndex = end;
    const value = pattern.exec(rest);
    if (value === null) return undefined;
    elements.push({ text: value[1] ?? value[2]!, bare: value[1] === undefined });
    end = pattern.lastIndex;
    if (rest[end] !== ",") return { elements, end };
    end += 1;
  }
}

/** Reads records separated by `,`, each made of values separated by `|`. */
function readRecords(rest: string, start: number): { records: ArgumentText[][]; end: number } | undefined {
  const records: ArgumentText[][] = [[]];
  let end = start;
  for (;;) {
    PIPED_ELEMENT.lastIndex = end;
    const value = PIPED_ELEMENT.exec(rest);
    if (value === null) return undefined;
    records.at(-1)!.push({ text: value[1] ?? value[2]!, bare: value[1] === undefined });
    end = PIPED_ELEMENT.lastIndex;
    if (rest[end] === "|") {
      end += 1;
    } else if (rest[end] === ",") {
      records.push([]);
      end += 1;
    } else {
      return { records, end };
    }
  }
}

type NamedArgument = { name: string; start: number; end: number } & (
  | { records: ArgumentText[][]; elements?: undefined }
  | { elements: ArgumentText[]; records?: undefined }
);

/**
 * Reads `name=value` (or `name=value,value` for a list, and records of `|` separated values for an object
 * parameter), starting at `start`. Returns undefined when what is there is not an argument of that shape.
 */
function readNamedArgument(rest: string, start: number, definition: MacroDefinition): NamedArgument | undefined {
  ARGUMENT_KEY.lastIndex = start;
  const key = ARGUMENT_KEY.exec(rest);
  if (key === null) return undefined;
  const name = key[1]!;
  const valueStart = ARGUMENT_KEY.lastIndex;

  if (fieldsOf(definition, name) !== undefined) {
    const read = readRecords(rest, valueStart);
    return read && { name, start: valueStart, end: read.end, records: read.records };
  }
  const read = readList(rest, valueStart, name.includes(".") ? SINGLE_VALUE : LIST_ELEMENT);
  return read && { name, start: valueStart, end: read.end, elements: read.elements };
}

function parseArguments(rest: string, definition: MacroDefinition, line: number): Map<string, Argument> {
  const args = new Map<string, Argument>();
  const unknown = (name: string) =>
    new MacroError(`Unknown argument "${name}" for macro "${definition.name}"`, line);
  const store = (key: string, elements: Element[], written: string) => {
    if (args.has(key)) throw new MacroError(`Duplicate argument "${key}"`, line);
    args.set(key, { elements, written });
  };
  /** Whether the value is a pointer (bare and starting with `@`), which must then be a valid one. */
  const isPointer = ({ text, bare }: ArgumentText) => {
    if (!bare || !text.startsWith("@")) return false;
    const pointer = parsePointer(text);
    if (!pointer.ok) throw new MacroError(pointer.error, line);
    return true;
  };
  const toElements = (texts: ArgumentText[]): Element[] =>
    texts.map((text) => ({ value: text.text, pointer: isPointer(text) }));

  let position = 0;
  while (position < rest.length) {
    const match = readNamedArgument(rest, position + 1, definition);
    if (match === undefined && position === 0) {
      // Only the first argument may be unlabeled: it is the macro's `$1`.
      const unlabeled = readList(rest, 1, POSITIONAL_ELEMENT);
      if (unlabeled !== undefined) {
        if (!definition.positional) {
          throw new MacroError(`Unexpected positional argument for macro "${definition.name}"`, line);
        }
        store(POSITIONAL, toElements(unlabeled.elements), rest.slice(1, unlabeled.end));
        position = unlabeled.end;
        continue;
      }
    }
    if (match === undefined) {
      const token = rest.slice(position + 1).split(" ")[0];
      throw new MacroError(`Invalid argument "${token}" (expected name=value or name="value")`, line);
    }
    const { name } = match;
    position = match.end;
    const written = rest.slice(match.start, match.end);

    const fields = fieldsOf(definition, name);
    if (fields !== undefined && match.records !== undefined) {
      const { records } = match;
      const [single] = records[0]!;
      if (records.length === 1 && records[0]!.length === 1 && single!.bare && single!.text.startsWith("@")) {
        const pointer = parsePointer(single!.text);
        if (!pointer.ok) throw new MacroError(pointer.error, line);
        if (pointer.written) throw new MacroError(mustNameFieldError(single!.text), line);
        for (const field of fields) {
          const kind = COLUMN_KINDS.get(field);
          if (kind === undefined) {
            throw new MacroError(
              `Field "${field}" of parameter "$${name}" is not a data dictionary column (expected ${COLUMN_NAMES.slice(0, -1).join(", ")} or ${COLUMN_NAMES.at(-1)})`,
              line,
            );
          }
          store(
            `${name}.${field}`,
            [{ value: `@${pointer.entity}.${pointer.field}.${kind}`, pointer: true }],
            written,
          );
        }
        continue;
      }
      for (const record of records) {
        if (record.length !== fields.length) {
          throw new MacroError(`Parameter "${name}" expects ${fields.length} values but got ${record.length}`, line);
        }
      }
      fields.forEach((field, index) =>
        store(
          `${name}.${field}`,
          records.map((record) => ({ value: record[index]!.text, pointer: false })),
          written,
        ),
      );
      continue;
    }

    const dot = name.indexOf(".");
    if (dot !== -1) {
      const objectFields = fieldsOf(definition, name.slice(0, dot));
      if (objectFields === undefined || !objectFields.includes(name.slice(dot + 1))) throw unknown(name);
    } else if (!definition.params.includes(name)) {
      throw unknown(name);
    }
    store(name, toElements(match.elements!), written);
  }
  if (definition.positional && !args.has(POSITIONAL)) {
    throw new MacroError(`Missing positional argument for macro "${definition.name}"`, line);
  }
  for (const param of definition.params) {
    for (const key of fieldsOf(definition, param)?.map((field) => `${param}.${field}`) ?? [param]) {
      if (!args.has(key)) throw new MacroError(`Missing argument "${key}" for macro "${definition.name}"`, line);
    }
  }
  return args;
}

/**
 * Replaces a macro use with its body. `line` is the line of the source as written that the whole expansion
 * is reported at, even when the use is nested in another macro's body.
 */
function expandUse(use: Use, nextIndent: number, line: number, out: string[], origins: LineOrigin[]) {
  const { definition, scope } = use.registered;
  const args = parseArguments(use.rest, definition, line);
  if (nextIndent > use.indent) throw new MacroError(`Macro "${definition.name}" cannot have children`, line);

  const padding = " ".repeat(use.indent);
  const single = (arg: Argument, name: string): Element => {
    if (arg.elements.length > 1) throw new MacroError(`Argument "${name}" is a list (use it in an Each)`, line);
    return arg.elements[0]!;
  };
  const substitute = (loops: Loops) => (_: string, name: string, field: string | undefined) => {
    const loop = loops.get(name);
    if (loop !== undefined) return loop.value + (field === undefined ? "" : `.${field}`);
    const recordField = field === undefined ? undefined : loops.get(`${name}.${field}`);
    if (recordField !== undefined) return recordField.value;
    if (fieldsOf(definition, name) !== undefined) return single(args.get(`${name}.${field}`)!, name).value;
    return single(args.get(name)!, name).value + (field === undefined ? "" : `.${field}`);
  };
  /** The elements a placeholder stands for when it is the whole content of a quoted string, or undefined. */
  const elementsOf = (loops: Loops, name: string, field: string | undefined): readonly Element[] | undefined => {
    const loop = loops.get(name);
    if (loop !== undefined) return field === undefined ? [loop] : undefined;
    const recordField = field === undefined ? undefined : loops.get(`${name}.${field}`);
    if (recordField !== undefined) return [recordField];
    if (fieldsOf(definition, name) !== undefined) {
      return field === undefined ? undefined : args.get(`${name}.${field}`)?.elements;
    }
    return field === undefined ? args.get(name)?.elements : undefined;
  };
  // A pointer that is the whole content of a quoted string loses the quotes, as quotes would make it a literal.
  const unquotePointer = (loops: Loops) => (quoted: string, name: string, field: string | undefined) => {
    const elements = elementsOf(loops, name, field);
    return elements?.length === 1 && elements[0]!.pointer ? elements[0]!.value : quoted;
  };

  const substituteLine = (raw: string, loops: Loops): string => {
    const written: string[] = [];
    let text = raw;
    if (readUse(raw, scope) !== undefined) {
      // A parameter that is the whole value of an argument is handed on as written, keeping a whole list.
      text = text.replace(WHOLE_ARGUMENT, (match, argument: string | undefined, name: string | undefined) => {
        if (argument === undefined || name === undefined) return match;
        const loop = loops.get(name);
        const arg = args.get(name);
        if (loop === undefined && arg === undefined) return match;
        // A loop element is quoted again, so that a literal stays one (a bare `@...` would become a pointer).
        written.push(loop === undefined ? arg!.written : loop.pointer ? loop.value : `"${loop.value}"`);
        return `${argument}=\u0000${written.length - 1}\u0000`;
      });
    }
    text = text.replace(QUOTED_PARAM_REFERENCE, unquotePointer(loops)).replace(PARAM_REFERENCE, substitute(loops));
    if (written.length === 0) return text;
    return text.replace(WRITTEN_PLACEHOLDER, (_, index: string) => written[Number(index)]!);
  };

  const substituted: string[] = [];
  const emit = (body: readonly string[], loops: Loops) => {
    for (let index = 0; index < body.length; index += 1) {
      const text = body[index]!;
      if (!EACH_WORD.test(text)) {
        substituted.push(substituteLine(text, loops));
        continue;
      }

      const indent = indentOf(text);
      const [, param, variable] = EACH_LINE.exec(text.trimEnd().slice(indent)) as unknown as [string, string, string];
      let end = index + 1;
      while (end < body.length && indentOf(body[end]!) > indent) end += 1;
      const children = body.slice(index + 1, end).map((child) => {
        const cut = Math.min(BODY_INDENT.length, indentOf(child) - indent);
        return child.slice(0, indent) + child.slice(indent + cut);
      });

      const fields = param === POSITIONAL ? undefined : fieldsOf(definition, param);
      const looped = args.get(fields === undefined ? param : `${param}.${fields[0]}`)!;
      looped.elements.forEach((element, position) => {
        const bound = new Map(loops);
        if (fields === undefined) {
          bound.set(variable, element);
        } else {
          for (const field of fields) {
            bound.set(`${variable}.${field}`, args.get(`${param}.${field}`)!.elements[position]!);
          }
        }
        emit(children, bound);
      });
      index = end - 1;
    }
  };
  emit(definition.body, new Map());

  const lines = substituted.map((text) => padding + text);
  lines.forEach((text, index) => {
    const nested = readUse(text, scope);
    if (nested !== undefined) {
      const following = lines[index + 1];
      expandUse(nested, following === undefined ? -1 : indentOf(following), line, out, origins);
      return;
    }
    out.push(text);
    origins.push({ line, macro: definition.name });
  });
}

function nextIndentAfter(lines: string[], index: number): number {
  const following = lines.slice(index + 1).find((text) => !isBlank(text));
  return following === undefined ? -1 : indentOf(following);
}

/** Registers the `Def`s of a text that is only a source of definitions: every other line is ignored. */
function registerSharedDefinitions(text: string, macros: Map<string, Registered>) {
  const lines = text.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const raw = lines[index]!;
    if (DEF_LINE.test(raw)) {
      const { registered, next } = readDefinition(lines, index, new Map(macros));
      macros.set(registered.definition.name, registered);
      index = next - 1;
    } else if (INDENTED_DEF_LINE.test(raw)) {
      throw new MacroError("Def must not be indented", index + 1);
    }
  }
}

/**
 * Expands every `Def` and macro use in `source`, giving core syntax and where each of its lines came from.
 * `shared` is a text whose `Def`s are defined above the first line of `source` (the global macros); its other
 * lines are ignored and an error in it is prefixed `Macros: `, as its line numbers are not the source's.
 */
export function expandMacros(source: string, shared = ""): ExpandResult {
  const lines = source.split(/\r?\n/);
  const macros = new Map<string, Registered>();
  const out: string[] = [];
  const origins: LineOrigin[] = [];
  let touched = false;

  try {
    registerSharedDefinitions(shared, macros);
  } catch (e) {
    if (e instanceof MacroError) return { ok: false, error: `Macros: ${e.message}` };
    throw e;
  }

  try {
    for (let index = 0; index < lines.length; index += 1) {
      const raw = lines[index]!;
      if (DEF_LINE.test(raw)) {
        touched = true;
        const { registered, next } = readDefinition(lines, index, new Map(macros));
        macros.set(registered.definition.name, registered);
        index = next - 1;
        continue;
      }
      if (INDENTED_DEF_LINE.test(raw)) throw new MacroError("Def must not be indented", index + 1);

      if (EACH_WORD.test(raw)) throw new MacroError("Each can only be used in a macro body", index + 1);

      const use = readUse(raw, macros);
      if (use !== undefined) {
        touched = true;
        expandUse(use, nextIndentAfter(lines, index), index + 1, out, origins);
        continue;
      }
      out.push(raw);
      origins.push({ line: index + 1 });
    }
  } catch (e) {
    if (e instanceof MacroError) return { ok: false, error: e.message };
    throw e;
  }
  return { ok: true, source: touched ? out.join("\n") : source, origins };
}
