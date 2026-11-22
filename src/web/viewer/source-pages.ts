/**
 * The wire frame source is stored as one text, but the editor shows it as one pane per page.
 * These pure, DOM-free functions convert between the two.
 * Rules: /capabilities/features/capability.md (`CI-014` entries).
 */

/** One page of a wire frame source as its pane shows it (UI-only, never stored or sent to the API). */
export type SourcePage = {
  /** The page title (`""` allowed). */
  title: string;
  /** The page id (`""` means the page has no `id`). */
  id: string;
  /** The page's nodes from column 0, without the page's 2-space indentation and without the `Page` line. */
  content: string;
};

/** Where a parse error belongs: the page position and the message to show under that pane. */
export type ParseErrorLocation = { page: number; message: string };

/** The message shown instead of `Page cannot be nested` for a `Page` typed in a pane. */
export const PAGE_IN_PANE_MESSAGE = "Page cannot be written here, it is created from the title and id";

const INDENT = "  ";
/** A `Page` line at indent 0. */
const PAGE_LINE = /^Page(?: |$)/;
/** A well-formed `Page "<title>" [id=<id>]` line; the title is greedy so it may contain quotes. */
const HEADER = /^Page "(.*)"(?: id=(.*))?$/;

const isBlank = (line: string) => line.trim() === "";

/** Reads the title and the optional id of a `Page` line. */
function readHeader(line: string): { title: string; id: string } {
  const trimmed = line.trimEnd();
  const match = HEADER.exec(trimmed);
  if (match) return { title: match[1]!, id: match[2] ?? "" };
  // Not a well-formed header: keep whatever follows `Page` as the title so no text is lost.
  return { title: trimmed.slice("Page".length).trim(), id: "" };
}

/** Removes up to 2 leading spaces; whitespace-only lines are left as they are. */
function unindent(line: string): string {
  return isBlank(line) ? line : line.replace(/^ {1,2}/, "");
}

/** Adds 2 spaces; blank lines are left as they are. */
function indent(line: string): string {
  return isBlank(line) ? line : INDENT + line;
}

/** The lines a page's content takes in the joined source (none for an empty content). */
function contentLines(content: string): string[] {
  return content === "" ? [] : content.split(/\r?\n/);
}

/**
 * Splits a source into one entry per `Page` line at indent 0, in source order. The empty source gives
 * one empty page; text before the first `Page` line goes into the first page's content.
 */
export function splitSourcePages(source: string): SourcePage[] {
  const pages: { title: string; id: string; lines: string[] }[] = [];
  const leading: string[] = [];

  for (const line of source.split(/\r?\n/)) {
    if (PAGE_LINE.test(line)) {
      pages.push({ ...readHeader(line), lines: [] });
    } else {
      (pages.length > 0 ? pages[pages.length - 1]!.lines : leading).push(unindent(line));
    }
  }

  // Without any `Page` line the whole source is the content of one empty page. Otherwise blank lines
  // before the first page carry no text, so they are dropped.
  const hasPages = pages.length > 0;
  if (!hasPages) pages.push({ title: "", id: "", lines: [] });
  if (!hasPages || !leading.every(isBlank)) pages[0]!.lines.unshift(...leading);

  return pages.map(({ title, id, lines }) => ({ title, id, content: lines.join("\n") }));
}

/** The `Page "<title>" [id=<id>]` line of a page. */
function header({ title, id }: SourcePage): string {
  return `Page "${title}"${id === "" ? "" : ` id=${id}`}`;
}

/** Joins the pages back into one source text: a `Page` line, then the page's content indented by 2 spaces. */
export function joinSourcePages(pages: readonly SourcePage[]): string {
  return pages.flatMap((page) => [header(page), ...contentLines(page.content).map(indent)]).join("\n");
}

/**
 * Maps the parser's error for `joinSourcePages(pages)` to the page it belongs to. A content error gets
 * `Line <n>: <message>` with `n` counted within the page's content; an error on the page's own line gets the
 * bare message. A source without an error (`undefined`) gives no location.
 */
export function locateParseError(
  pages: readonly SourcePage[],
  error: string | undefined,
): ParseErrorLocation | undefined {
  if (error === undefined) return undefined;

  const match = /^Line (\d+): ([\s\S]*)$/.exec(error);
  // An error without a line number (a schema error) cannot be placed more precisely than the first page.
  if (!match) return { page: 0, message: error };

  const line = Number(match[1]);
  const message = match[2]!;
  let start = 1;
  for (const [index, page] of pages.entries()) {
    if (line === start) return { page: index, message };
    const count = contentLines(page.content).length;
    if (line <= start + count) {
      const shown = message === "Page cannot be nested" ? PAGE_IN_PANE_MESSAGE : message;
      return { page: index, message: `Line ${line - start}: ${shown}` };
    }
    start += 1 + count;
  }
  return { page: Math.max(pages.length - 1, 0), message: error };
}
