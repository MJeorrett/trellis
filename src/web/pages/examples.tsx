import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import type { DataDictionaryRow } from "@/data-dictionary/schema";
import { examples as builtInExamples, exampleDataDictionary, type Example } from "@/examples/examples";
import { compileSyntax } from "@/syntax/compile";
import { PageTabs } from "@/viewer/pages";

const headerCell = "px-2 py-1 text-left font-medium";
const cell = "px-2 py-1 align-top";

/** One example: its read-only annotated source beside (or above, when narrow) the wire frame it compiles to. */
function ExampleSection({
  example,
  dataDictionary,
}: {
  example: Example;
  dataDictionary: readonly DataDictionaryRow[];
}) {
  const [selectedPage, setSelectedPage] = useState(0);
  // No shared macros: an example defines its own, so the user's macros cannot break it.
  const result = useMemo(
    () => compileSyntax(example.source, undefined, dataDictionary),
    [example.source, dataDictionary],
  );

  return (
    <section aria-label={example.title} className="flex flex-col gap-2">
      <h2 className="text-lg font-medium">{example.title}</h2>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardContent className="min-w-0">
            <pre aria-label={`${example.title} source`} className="overflow-x-auto font-mono text-xs">
              {example.source}
            </pre>
          </CardContent>
        </Card>
        <Card>
          {/* The sketch tilt and borders overflow the page by a pixel or two, so the page does not scroll here. */}
          <CardContent className="flex min-w-0 flex-col [&_[data-slot=tabs-content]]:overflow-visible [&_[data-slot=tabs-content]]:p-1">
            {result.ok ? (
              <PageTabs pages={result.ast.pages} selectedIndex={selectedPage} onSelect={setSelectedPage} />
            ) : (
              <pre role="alert" className="whitespace-pre-wrap text-xs text-destructive">
                {result.error}
              </pre>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

function ExampleDataDictionary({ rows }: { rows: readonly DataDictionaryRow[] }) {
  return (
    <section aria-label="Data dictionary used by these examples" className="flex flex-none flex-col gap-2">
      <h2 className="text-lg font-medium">Data dictionary used by these examples</h2>
      <div className="max-h-52 overflow-auto rounded-lg bg-card ring-1 ring-foreground/10">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th scope="col" className={headerCell}>
                Entity
              </th>
              <th scope="col" className={headerCell}>
                Field
              </th>
              <th scope="col" className={headerCell}>
                DataType
              </th>
              <th scope="col" className={headerCell}>
                Label
              </th>
              <th scope="col" className={headerCell}>
                MockValues
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={index}>
                <td className={cell}>{row.entity}</td>
                <td className={cell}>{row.field}</td>
                <td className={cell}>{row.dataType}</td>
                <td className={cell}>{row.label}</td>
                <td className={cell}>{row.mockValues}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function ExamplesView({
  examples = builtInExamples,
  dataDictionary = exampleDataDictionary,
}: {
  examples?: readonly Example[];
  dataDictionary?: readonly DataDictionaryRow[];
}) {
  return (
    <main className="flex h-full min-h-0 flex-col gap-4 overflow-hidden p-4">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 pr-2">
          <h1 className="text-xl font-semibold">Examples</h1>
          {examples.map((example) => (
            <ExampleSection key={example.title} example={example} dataDictionary={dataDictionary} />
          ))}
        </div>
      </div>
      <ExampleDataDictionary rows={dataDictionary} />
    </main>
  );
}

export default function ExamplesPage() {
  return <ExamplesView />;
}
