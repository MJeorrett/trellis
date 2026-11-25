import { describe, expect, it } from "vitest";
import { buildAgentMarkdown } from "./markdown";
import { examples, exampleDataDictionary } from "./examples";
import { syntaxSummary } from "./summary";

const markdown = buildAgentMarkdown(syntaxSummary, examples, exampleDataDictionary);

describe("buildAgentMarkdown", () => {
  it("starts with the title and the summary as a numbered list", () => {
    expect(markdown.startsWith("# Trellis wire frame syntax\n\n## How Trellis syntax works\n\n1. ")).toBe(true);
    syntaxSummary.rules.forEach((rule, index) => expect(markdown).toContain(`${index + 1}. ${rule}\n`));
  });

  it("has a section per example, in order, with its exact source", () => {
    let from = 0;
    for (const example of examples) {
      const heading = markdown.indexOf(`\n## ${example.title}\n`, from);
      expect(heading).toBeGreaterThanOrEqual(from);
      const source = markdown.indexOf(example.source, heading);
      expect(source).toBeGreaterThan(heading);
      from = source;
    }
  });

  it("ends with the data dictionary as a table, then one newline", () => {
    const section = markdown.slice(markdown.indexOf("\n## Data dictionary used by these examples\n"));
    expect(section).toContain("| Entity | Field | DataType | Label | MockValues |");
    expect(section).toContain("| --- | --- | --- | --- | --- |");
    for (const row of exampleDataDictionary) {
      expect(section).toContain(`| ${row.entity} | ${row.field} | ${row.dataType} | ${row.label} | ${row.mockValues} |`);
    }
    expect(markdown.endsWith("|\n")).toBe(true);
    expect(markdown.endsWith("\n\n")).toBe(false);
  });

  it("escapes | in a table cell", () => {
    const result = buildAgentMarkdown(syntaxSummary, [], [
      { entity: "E", field: "F", dataType: "string", label: "a|b", mockValues: "" },
    ]);
    expect(result).toContain("| E | F | string | a\\|b |  |");
  });

  it("has balanced code fences", () => {
    const fences = markdown.split("\n").filter((line) => line.startsWith("```"));
    expect(fences.length).toBe(examples.length * 2);
    expect(fences.every((fence) => fence === "```")).toBe(true);
  });

  it("round-trips a source that contains a backtick fence", () => {
    const source = '# an example of a fence: ```` and ```\nPage "P"\n';
    const result = buildAgentMarkdown(syntaxSummary, [{ title: "Tricky", source }], []);
    expect(result).toContain(`\n## Tricky\n\n\`\`\`\`\`\n${source}\`\`\`\`\`\n`);
    const fenceLines = result.split("\n").filter((line) => /^`{3,}$/.test(line));
    expect(fenceLines).toEqual(["`````", "`````"]);
  });

  it("adds the missing newline of a source before the closing fence", () => {
    const result = buildAgentMarkdown(syntaxSummary, [{ title: "T", source: 'Page "P"' }], []);
    expect(result).toContain('## T\n\n```\nPage "P"\n```\n');
  });

  it("holds no preview markup", () => {
    expect(markdown).not.toMatch(/<(div|svg|section|button|pre|main)\b/);
    expect(markdown).not.toContain('aria-label="Pages"');
  });
});
