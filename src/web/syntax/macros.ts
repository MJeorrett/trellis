import { z } from "zod";
import { NodeTypeSchema } from "@/schema/ast";

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
export const MacroDefinitionSchema = z.strictObject({
  name: MacroNameSchema,
  params: z.array(ParamNameSchema),
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
const PARAM_REFERENCE = /\$(1(?![A-Za-z0-9_])|[A-Za-z][A-Za-z0-9_]*)/g;
const ARGUMENT = /([^ "=]+)=(?:"([^"]*)"|([^ "]+))(?= |$)/y;
const POSITIONAL_ARGUMENT = /(?:"([^"]*)"|([^ "=]+))(?= |$)/y;
const DEF_LINE = /^Def(?: |$)/;
const INDENTED_DEF_LINE = /^ +Def(?: |$)/;

type Registered = { definition: MacroDefinition; scope: Scope };
/** The macros a line may use: the ones defined above it. */
type Scope = ReadonlyMap<string, Registered>;
type Use = { registered: Registered; indent: number; rest: string };

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
  for (const token of paramTokens) {
    if (!token.startsWith("$") || !ParamNameSchema.safeParse(token.slice(1)).success) {
      throw new MacroError(`Invalid parameter "${token}" (expected $name)`, line);
    }
    if (params.includes(token.slice(1))) throw new MacroError(`Duplicate parameter "${token}"`, line);
    params.push(token.slice(1));
  }

  let next = start + 1;
  while (next < lines.length && (isBlank(lines[next]!) || lines[next]!.startsWith(" "))) next += 1;

  const body: string[] = [];
  let positional = false;
  for (let index = start + 1; index < next; index += 1) {
    const text = lines[index]!;
    if (isBlank(text)) continue;
    for (const [, paramName] of text.matchAll(PARAM_REFERENCE)) {
      if (paramName === POSITIONAL) positional = true;
      else if (!params.includes(paramName!)) {
        throw new MacroError(`Unknown parameter "$${paramName}" in macro "${name}"`, index + 1);
      }
    }
    body.push(text.startsWith(BODY_INDENT) ? text.slice(BODY_INDENT.length) : ` ${text.trimStart()}`);
  }
  if (body.length === 0) throw new MacroError(`Macro "${name}" has an empty body`, line);

  const definition = MacroDefinitionSchema.parse({ name, params, positional, body });
  return { registered: { definition, scope }, next };
}

function parseArguments(rest: string, definition: MacroDefinition, line: number): Map<string, string> {
  const args = new Map<string, string>();
  let position = 0;
  while (position < rest.length) {
    ARGUMENT.lastIndex = position + 1;
    const match = ARGUMENT.exec(rest);
    if (match === null && position === 0) {
      // Only the first argument may be unlabeled: it is the macro's `$1`.
      POSITIONAL_ARGUMENT.lastIndex = 1;
      const unlabeled = POSITIONAL_ARGUMENT.exec(rest);
      if (unlabeled !== null) {
        if (!definition.positional) {
          throw new MacroError(`Unexpected positional argument for macro "${definition.name}"`, line);
        }
        args.set(POSITIONAL, unlabeled[1] ?? unlabeled[2]!);
        position = POSITIONAL_ARGUMENT.lastIndex;
        continue;
      }
    }
    if (match === null) {
      const token = rest.slice(position + 1).split(" ")[0];
      throw new MacroError(`Invalid argument "${token}" (expected name=value or name="value")`, line);
    }
    const name = match[1]!;
    if (!definition.params.includes(name)) {
      throw new MacroError(`Unknown argument "${name}" for macro "${definition.name}"`, line);
    }
    if (args.has(name)) throw new MacroError(`Duplicate argument "${name}"`, line);
    args.set(name, match[2] ?? match[3]!);
    position = ARGUMENT.lastIndex;
  }
  if (definition.positional && !args.has(POSITIONAL)) {
    throw new MacroError(`Missing positional argument for macro "${definition.name}"`, line);
  }
  for (const param of definition.params) {
    if (!args.has(param)) throw new MacroError(`Missing argument "${param}" for macro "${definition.name}"`, line);
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
  const lines = definition.body.map(
    (text) => padding + text.replace(PARAM_REFERENCE, (_, name: string) => args.get(name)!),
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
