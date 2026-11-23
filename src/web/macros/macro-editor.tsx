import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import type { DataDictionaryRow } from "@/data-dictionary/schema";
import { compileSyntax } from "@/syntax/compile";
import { PageTabs } from "@/viewer/pages";

/**
 * The global macros: one source text (no tabs) and, beside it, the wire frame it compiles to, so macros can be
 * tried out. The text may also hold `Page`s that use the macros; only its `Def`s are shared with the features.
 */
export function MacroEditor({
  source,
  onSourceChange,
  dataDictionary,
}: {
  source: string;
  onSourceChange: (source: string) => void;
  /** The fields that `@Entity.Field` references in the pages of `source` name. */
  dataDictionary?: readonly DataDictionaryRow[];
}) {
  const [selectedPage, setSelectedPage] = useState(0);
  const result = useMemo(() => compileSyntax(source, undefined, dataDictionary), [source, dataDictionary]);

  return (
    <div className="grid h-full min-h-0 grid-rows-2 gap-4 md:grid-cols-2 md:grid-rows-1">
      <Card className="min-h-0 overflow-hidden">
        <CardContent className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
          {!result.ok && (
            <pre role="alert" className="flex-none whitespace-pre-wrap text-xs text-destructive">
              {result.error}
            </pre>
          )}
          <Textarea
            aria-label="Macros source"
            className="min-h-0 flex-1 font-mono text-xs"
            placeholder={"Def Field $label\n  Text \"$label\""}
            spellCheck={false}
            value={source}
            onChange={(e) => onSourceChange(e.target.value)}
          />
        </CardContent>
      </Card>
      <Card className="min-h-0 overflow-hidden">
        <CardContent className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {result.ok ? (
            <PageTabs pages={result.ast.pages} selectedIndex={selectedPage} onSelect={setSelectedPage} />
          ) : (
            <p className="text-sm text-muted-foreground">Fix the source to see the wire frame.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
