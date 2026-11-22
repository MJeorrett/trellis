import { useMemo, useState } from "react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { parseSyntax } from "@/syntax/parse";
import { PageTabs } from "@/viewer/pages";
import { joinSourcePages, locateParseError, splitSourcePages, type SourcePage } from "@/viewer/source-pages";

/** The page appended by `+ Add Page`: titled `Page N`, with the id `page-N` (the next free N if taken). */
export function newSourcePage(pages: readonly SourcePage[]): SourcePage {
  const ids = new Set(pages.map((page) => page.id));
  let n = pages.length + 1;
  while (ids.has(`page-${n}`)) n += 1;
  return { title: `Page ${n}`, id: `page-${n}`, content: "" };
}

export function WireframeEditor({
  source,
  onSourceChange,
}: {
  source: string;
  onSourceChange: (source: string) => void;
}) {
  const [selectedPage, setSelectedPage] = useState(0);
  // The panes whose source is shown, by position. Only the first is expanded when the editor is first shown.
  const [expanded, setExpanded] = useState<string[]>(["0"]);
  // The panes are an editing view of the one stored text. The parser runs on the joined pages so that its
  // line numbers match what the panes show.
  const pages = useMemo(() => splitSourcePages(source), [source]);
  const result = useMemo(() => parseSyntax(joinSourcePages(pages)), [pages]);
  const location = useMemo(() => locateParseError(pages, result.ok ? undefined : result.error), [pages, result]);

  const change = (next: SourcePage[]) => onSourceChange(joinSourcePages(next));
  const update = (index: number, patch: Partial<SourcePage>) =>
    change(pages.map((page, i) => (i === index ? { ...page, ...patch } : page)));

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Wire frame source</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Accordion multiple value={expanded} onValueChange={setExpanded} className="gap-4">
            {pages.map((page, index) => {
              const label = `Page ${index + 1}`;
              const error = location?.page === index ? location.message : undefined;
              return (
                <AccordionItem
                  key={index}
                  value={String(index)}
                  className="rounded-lg border border-foreground/30 p-3"
                >
                  <div className="flex flex-row items-center gap-2 text-sm">
                    <span className="font-medium">Page:</span>
                    <Input
                      aria-label={`${label} title`}
                      value={page.title}
                      onChange={(e) => update(index, { title: e.target.value })}
                    />
                    <span className="font-medium">Id:</span>
                    <Input
                      aria-label={`${label} id`}
                      value={page.id}
                      onChange={(e) => update(index, { id: e.target.value })}
                    />
                    <AccordionTrigger
                      aria-label={`Toggle ${label} source`}
                      className="w-8 flex-none items-center justify-center py-1.5"
                    />
                  </div>
                  {/* Kept mounted while collapsed, so the text area is only hidden and keeps its state. */}
                  <AccordionContent keepMounted className="p-1 pb-0">
                    <Textarea
                      aria-label={`${label} source`}
                      className="min-h-32 font-mono text-xs"
                      spellCheck={false}
                      value={page.content}
                      onChange={(e) => update(index, { content: e.target.value })}
                    />
                  </AccordionContent>
                  {/* Outside the panel, so an error is still visible when the pane is collapsed. */}
                  {error !== undefined && (
                    <pre role="alert" className="mt-2 whitespace-pre-wrap text-xs text-destructive">
                      {error}
                    </pre>
                  )}
                </AccordionItem>
              );
            })}
          </Accordion>
          <div className="flex justify-center">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                // The new page starts expanded so it can be filled in straight away.
                setExpanded([...expanded, String(pages.length)]);
                change([...pages, newSourcePage(pages)]);
              }}
            >
              + Add Page
            </Button>
          </div>
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
