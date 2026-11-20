import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { parseAstJson } from "@/viewer/parse";
import { sampleAst } from "@/viewer/sample";
import { WireframeNode } from "@/viewer/wireframe";

export default function App() {
  const [source, setSource] = useState(() => JSON.stringify(sampleAst, null, 2));
  const result = useMemo(() => parseAstJson(source), [source]);

  return (
    <main className="mx-auto grid min-h-screen max-w-6xl gap-4 p-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>AST (JSON)</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <Textarea
            aria-label="AST JSON"
            className="min-h-[28rem] font-mono text-xs"
            spellCheck={false}
            value={source}
            onChange={(e) => setSource(e.target.value)}
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
            <WireframeNode node={result.ast} />
          ) : (
            <p className="text-sm text-muted-foreground">Fix the AST to see the wire frame.</p>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
