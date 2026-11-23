import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { parseSyntax } from "@/syntax/parse";
import { PageTabs, resolveSelectedIndex } from "@/viewer/pages";
import {
  addSourcePage,
  joinSourcePages,
  locateParseError,
  pageTabLabel,
  splitSourcePages,
} from "@/viewer/source-pages";

export function WireframeEditor({
  source,
  onSourceChange,
}: {
  source: string;
  onSourceChange: (source: string) => void;
}) {
  const [selectedPage, setSelectedPage] = useState(0);
  const [selectedSource, setSelectedSource] = useState(0);
  // The tabs are an editing view of the one stored text, so they are derived from it on every change.
  const pages = useMemo(() => splitSourcePages(source), [source]);
  const result = useMemo(() => parseSyntax(source), [source]);
  const location = useMemo(() => locateParseError(pages, result.ok ? undefined : result.error), [pages, result]);

  const current = resolveSelectedIndex(selectedSource, pages.length);
  const label = (index: number) => pageTabLabel(pages[index]!, index);

  return (
    <div className="grid h-full min-h-0 grid-rows-2 gap-4 md:grid-cols-2 md:grid-rows-1">
      <Card className="min-h-0 overflow-hidden">
        <CardContent className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <Tabs
            value={current}
            onValueChange={(value) => setSelectedSource(Number(value))}
            className="min-h-0 flex-1"
          >
            <div className="flex flex-none flex-row items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                aria-label="Add page"
                onClick={() => {
                  // The new page is selected so it can be filled in straight away.
                  setSelectedSource(pages.length);
                  onSourceChange(joinSourcePages(addSourcePage(pages)));
                }}
              >
                +
              </Button>
              <TabsList aria-label="Source pages" className="h-auto max-w-full flex-wrap">
                {pages.map((_, index) => (
                  <TabsTrigger key={index} value={index}>
                    {label(index)}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>
            {/* Above the text, so it is seen without scrolling; it names the page when that tab is not selected. */}
            {location !== undefined && (
              <pre role="alert" className="flex-none whitespace-pre-wrap text-xs text-destructive">
                {location.page === current ? location.message : `${label(location.page)}: ${location.message}`}
              </pre>
            )}
            <TabsContent value={current} className="min-h-0 overflow-y-auto p-1">
              <Textarea
                aria-label={`Page ${current + 1} source`}
                className="min-h-48 font-mono text-xs"
                placeholder={'Page "Page 1" id=page-1'}
                spellCheck={false}
                value={pages[current]}
                onChange={(e) =>
                  onSourceChange(joinSourcePages(pages.map((text, i) => (i === current ? e.target.value : text))))
                }
              />
            </TabsContent>
          </Tabs>
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
