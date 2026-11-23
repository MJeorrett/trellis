/**
 * The wire frame source is stored as one text, but the editor shows it as one tab per page, each holding
 * that page's text: its `Page` line and the lines under it, exactly as stored. These pure, DOM-free
 * functions convert between the two.
 * Rules: /capabilities/features/capability.md (`CI-017` entries).
 */

/** Where a parse error belongs: the page position and the message to show for it. */
export type ParseErrorLocation = { page: number; message: string };

/** A `Page` line at indent 0. */
const PAGE_LINE = /^Page(?: |$)/;
/** A well-formed `Page "<title>" [id=<id>]` line; the title is greedy so it may contain quotes. */
const HEADER = /^Page "(.*)"(?: id=(.*))?$/;

const isBlank = (text: string) => text.trim() === "";

/**
 * Splits a source into one text per `Page` line at indent 0, in source order. Text before the first `Page`
 * line stays with the first page, so the tabs match the pages the parser finds. The empty source gives one
 * empty text.
 */
export function splitSourcePages(source: string): string[] {
  const pages: string[][] = [[]];
  let seenPage = false;
  for (const line of source.split(/\r?\n/)) {
    if (PAGE_LINE.test(line)) {
      if (seenPage) pages.push([]);
      seenPage = true;
    }
    pages[pages.length - 1]!.push(line);
  }
  return pages.map((lines) => lines.join("\n"));
}

/** The inverse of `splitSourcePages`: the page texts joined by newlines. */
export function joinSourcePages(pages: readonly string[]): string {
  return pages.join("\n");
}

/** The title and id written on the first `Page` line of a page's text (`""` when there is none). */
export function readPageHeader(text: string): { title: string; id: string } {
  const line = text.split(/\r?\n/).find((l) => PAGE_LINE.test(l));
  if (line === undefined) return { title: "", id: "" };
  const trimmed = line.trimEnd();
  const match = HEADER.exec(trimmed);
  if (match) return { title: match[1]!, id: match[2] ?? "" };
  // Not a well-formed header: keep whatever follows `Page` as the title so the tab still has a name.
  return { title: trimmed.slice("Page".length).trim(), id: "" };
}

/** The tab label of a page: its title, or `Page N` (1-based position) when the title is empty. */
export function pageTabLabel(text: string, index: number): string {
  const { title } = readPageHeader(text);
  return title === "" ? `Page ${index + 1}` : title;
}

/**
 * The pages after `+` is clicked: a new last page titled `Page N` with the id `page-N` (N is its 1-based
 * position, or the next free number when that id is taken). A blank source has no page to keep, so its
 * only empty text is replaced by the new page.
 */
export function addSourcePage(pages: readonly string[]): string[] {
  const kept = pages.length === 1 && isBlank(pages[0]!) ? [] : pages;
  const ids = new Set(kept.map((text) => readPageHeader(text).id));
  let n = kept.length + 1;
  while (ids.has(`page-${n}`)) n += 1;
  return [...kept, `Page "Page ${n}" id=page-${n}`];
}

/** The lines a page's text takes in the joined source (an empty text still takes one). */
const lineCount = (text: string) => text.split("\n").length;

/**
 * Maps the parser's error for `joinSourcePages(pages)` to the page it belongs to, with the line counted
 * within that page's text (line 1 is its `Page` line). A source without an error (`undefined`) gives no
 * location.
 */
export function locateParseError(
  pages: readonly string[],
  error: string | undefined,
): ParseErrorLocation | undefined {
  if (error === undefined) return undefined;

  const match = /^Line (\d+): ([\s\S]*)$/.exec(error);
  // An error without a line number (a schema error) cannot be placed more precisely than the first page.
  if (!match) return { page: 0, message: error };

  const line = Number(match[1]);
  const message = match[2]!;
  let start = 1;
  for (const [index, text] of pages.entries()) {
    const count = lineCount(text);
    if (line < start + count) return { page: index, message: `Line ${line - start + 1}: ${message}` };
    start += count;
  }
  return { page: Math.max(pages.length - 1, 0), message: error };
}
