import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { parseSyntax } from "@/syntax/parse";
import { PageTabs } from "@/viewer/pages";

export function WireframeEditor({
  source,
  onSourceChange,
}: {
  source: string;
  onSourceChange: (source: string) => void;
}) {
  const [selectedPage, setSelectedPage] = useState(0);
  const result = useMemo(() => parseSyntax(source), [source]);

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Wire frame source</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <Textarea
            aria-label="Wire frame source"
            className="min-h-[28rem] font-mono text-xs"
            spellCheck={false}
            value={source}
            onChange={(e) => onSourceChange(e.target.value)}
          />
          {!result.ok && (
            <pre role="alert" className="whitespace-pre-wrap text-xs text-destructive">
              {result.error}
            </pre>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Wire frame</CardTitle>
        </CardHeader>
        <CardContent>
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
