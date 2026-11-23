import { z } from "zod";
import { NodeTypeSchema } from "@/schema/ast";
import { mustNameFieldError, parsePointer, POINTER_COLUMNS } from "@/syntax/pointer";

/**
 * Macro preprocessor: expands `Def` macros into core syntax before the source is parsed.
 * Rules: /capabilities/macros/capability.md.
 */

const RESERVED_NAMES: ReadonlySet<string> = new Set([...NodeTypeSchema.options, "Page", "Def"]);

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
const ARGUMENT_VALUE = /(?:"([^"]*)"|([^ "]+))(?= |$)/y;
const PIPED_VALUE = /(?:"([^"]*)"|([^ "|]+))(?=[ |]|$)/y;
const POSITIONAL_ARGUMENT = /(?:"([^"]*)"|([^ "=]+))(?= |$)/y;
const DEF_LINE = /^Def(?: |$)/;
const INDENTED_DEF_LINE = /^ +Def(?: |$)/;

type Registered = { definition: MacroDefinition; scope: Scope };
/** The macros a line may use: the ones defined above it. */
type Scope = ReadonlyMap<string, Registered>;
type Use = { registered: Registered; indent: number; rest: string };
/** A value as written in an argument: without its quotes, and whether it had none (a bare `@...` is a pointer). */
type ArgumentText = { text: string; bare: boolean };
/** A stored argument value; a pointer is substituted without the quotes the body puts around it. */
type Argument = { value: string; pointer: boolean };

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
  let positional = false;
  for (let index = start + 1; index < next; index += 1) {
    const text = lines[index]!;
    if (isBlank(text)) continue;
    for (const [, paramName, fieldName] of text.matchAll(PARAM_REFERENCE)) {
      if (paramName === POSITIONAL) {
        positional = true;
        continue;
      }
      if (!params.includes(paramName!)) {
        throw new MacroError(`Unknown parameter "$${paramName}" in macro "${name}"`, index + 1);
      }
      const fields = Object.hasOwn(objects, paramName!) ? objects[paramName!]! : undefined;
      if (fields === undefined) continue;
      if (fieldName === undefined) {
        throw new MacroError(`Parameter "$${paramName}" is an object (use $${paramName}.<field>)`, index + 1);
      }
      if (!fields.includes(fieldName)) {
        throw new MacroError(`Unknown field "${fieldName}" on parameter "$${paramName}"`, index + 1);
      }
    }
    body.push(text.startsWith(BODY_INDENT) ? text.slice(BODY_INDENT.length) : ` ${text.trimStart()}`);
  }
  if (body.length === 0) throw new MacroError(`Macro "${name}" has an empty body`, line);

  const definition = MacroDefinitionSchema.parse({ name, params, objects, positional, body });
  return { registered: { definition, scope }, next };
}

const fieldsOf = (definition: MacroDefinition, param: string): readonly string[] | undefined =>
  Object.hasOwn(definition.objects, param) ? definition.objects[param] : undefined;

/**
 * Reads `name=value`, or `name=value|value|...` for an object parameter, starting at `start`.
 * Returns undefined when what is there is not an argument of that shape.
 */
function readNamedArgument(
  rest: string,
  start: number,
  definition: MacroDefinition,
): { name: string; values: ArgumentText[]; end: number } | undefined {
  ARGUMENT_KEY.lastIndex = start;
  const key = ARGUMENT_KEY.exec(rest);
  if (key === null) return undefined;
  const name = key[1]!;
  const piped = fieldsOf(definition, name) !== undefined;
  const pattern = piped ? PIPED_VALUE : ARGUMENT_VALUE;

  const values: ArgumentText[] = [];
  let end = ARGUMENT_KEY.lastIndex;
  for (;;) {
    pattern.lastIndex = end;
    const value = pattern.exec(rest);
    if (value === null) return undefined;
    values.push({ text: value[1] ?? value[2]!, bare: value[1] === undefined });
    end = pattern.lastIndex;
    if (!piped || rest[end] !== "|") return { name, values, end };
    end += 1;
  }
}

function parseArguments(rest: string, definition: MacroDefinition, line: number): Map<string, Argument> {
  const args = new Map<string, Argument>();
  const unknown = (name: string) =>
    new MacroError(`Unknown argument "${name}" for macro "${definition.name}"`, line);
  const store = (key: string, value: string, pointer = false) => {
    if (args.has(key)) throw new MacroError(`Duplicate argument "${key}"`, line);
    args.set(key, { value, pointer });
  };
  /** Whether the value is a pointer (bare and starting with `@`), which must then be a valid one. */
  const isPointer = ({ text, bare }: ArgumentText) => {
    if (!bare || !text.startsWith("@")) return false;
    const pointer = parsePointer(text);
    if (!pointer.ok) throw new MacroError(pointer.error, line);
    return true;
  };

  let position = 0;
  while (position < rest.length) {
    const match = readNamedArgument(rest, position + 1, definition);
    if (match === undefined && position === 0) {
      // Only the first argument may be unlabeled: it is the macro's `$1`.
      POSITIONAL_ARGUMENT.lastIndex = 1;
      const unlabeled = POSITIONAL_ARGUMENT.exec(rest);
      if (unlabeled !== null) {
        if (!definition.positional) {
          throw new MacroError(`Unexpected positional argument for macro "${definition.name}"`, line);
        }
        const value = { text: unlabeled[1] ?? unlabeled[2]!, bare: unlabeled[1] === undefined };
        store(POSITIONAL, value.text, isPointer(value));
        position = POSITIONAL_ARGUMENT.lastIndex;
        continue;
      }
    }
    if (match === undefined) {
      const token = rest.slice(position + 1).split(" ")[0];
      throw new MacroError(`Invalid argument "${token}" (expected name=value or name="value")`, line);
    }
    const { name, values } = match;
    position = match.end;

    const fields = fieldsOf(definition, name);
    if (fields !== undefined) {
      const [single] = values;
      if (values.length === 1 && single!.bare && single!.text.startsWith("@")) {
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
          store(`${name}.${field}`, `@${pointer.entity}.${pointer.field}.${kind}`, true);
        }
        continue;
      }
      if (values.length !== fields.length) {
        throw new MacroError(`Parameter "${name}" expects ${fields.length} values but got ${values.length}`, line);
      }
      fields.forEach((field, index) => store(`${name}.${field}`, values[index]!.text));
      continue;
    }

    const dot = name.indexOf(".");
    if (dot !== -1) {
      const objectFields = fieldsOf(definition, name.slice(0, dot));
      if (objectFields === undefined || !objectFields.includes(name.slice(dot + 1))) throw unknown(name);
    } else if (!definition.params.includes(name)) {
      throw unknown(name);
    }
    store(name, values[0]!.text, isPointer(values[0]!));
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
  const substitute = (_: string, name: string, field: string | undefined) => {
    if (fieldsOf(definition, name) !== undefined) return args.get(`${name}.${field}`)!.value;
    return args.get(name)!.value + (field === undefined ? "" : `.${field}`);
  };
  // A pointer that is the whole content of a quoted string loses the quotes, as quotes would make it a literal.
  const unquotePointer = (quoted: string, name: string, field: string | undefined) => {
    const key = fieldsOf(definition, name) !== undefined ? `${name}.${field}` : field === undefined ? name : undefined;
    const arg = key === undefined ? undefined : args.get(key);
    return arg?.pointer ? arg.value : quoted;
  };
  const lines = definition.body.map(
    (text) => padding + text.replace(QUOTED_PARAM_REFERENCE, unquotePointer).replace(PARAM_REFERENCE, substitute),
  );
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
