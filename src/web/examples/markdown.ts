import type { DataDictionaryRow } from "@/data-dictionary/schema";
import type { Example } from "./examples";
import type { SyntaxSummary } from "./summary";

const DICTIONARY_HEADING = "Data dictionary used by these examples";
const DICTIONARY_COLUMNS = ["Entity", "Field", "DataType", "Label", "MockValues"] as const;

/** A fence one backtick longer than the longest run in the text (at least 3), so the text cannot close it early. */
function fenced(text: string): string {
  const longestRun = Math.max(0, ...(text.match(/`+/g) ?? []).map((run) => run.length));
  const fence = "`".repeat(Math.max(3, longestRun + 1));
  return `${fence}\n${text.endsWith("\n") ? text : `${text}\n`}${fence}`;
}

const tableRow = (cells: readonly string[]) => `| ${cells.map((cell) => cell.replace(/\|/g, "\\|")).join(" | ")} |`;

function dictionaryTable(rows: readonly DataDictionaryRow[]): string {
  return [
    tableRow(DICTIONARY_COLUMNS),
    tableRow(DICTIONARY_COLUMNS.map(() => "---")),
    ...rows.map((row) => tableRow([row.entity, row.field, row.dataType, row.label, row.mockValues])),
  ].join("\n");
}

/** The text `Copy for agents` copies: the summary, every example's source and the data dictionary they use, with no previews. */
export function buildAgentMarkdown(
  summary: SyntaxSummary,
  examples: readonly Example[],
  dataDictionary: readonly DataDictionaryRow[],
): string {
  const sections = [
    "# Trellis wire frame syntax",
    `## ${summary.heading}\n\n${summary.rules.map((rule, index) => `${index + 1}. ${rule}`).join("\n")}`,
    ...examples.map((example) => `## ${example.title}\n\n${fenced(example.source)}`),
    `## ${DICTIONARY_HEADING}\n\n${dictionaryTable(dataDictionary)}`,
  ];
  return `${sections.join("\n\n")}\n`;
}
