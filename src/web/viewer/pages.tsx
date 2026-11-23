import { toast } from "sonner";
import type { Page } from "@/schema/ast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WireframeNode } from "./wireframe";

/** Tab label for a page: its title, or `Page N` (1-based position) when the title is empty. */
export function pageLabel(page: Page, index: number): string {
  return page.title === "" ? `Page ${index + 1}` : page.title;
}

/**
 * The selected page position, kept by position across edits: it falls back to the
 * last page when `selected` no longer exists.
 */
export function resolveSelectedIndex(selected: number, pageCount: number): number {
  return Math.max(0, Math.min(selected, pageCount - 1));
}

export function findPageIndexById(pages: Page[], id: string): number | undefined {
  const index = pages.findIndex((page) => page.id === id);
  return index === -1 ? undefined : index;
}

export type LinkResolution = { index: number } | { notFound: string };

export function resolveLink(pages: Page[], id: string): LinkResolution {
  const index = findPageIndexById(pages, id);
  return index === undefined ? { notFound: id } : { index };
}

export function linkNotFoundMessage(id: string): string {
  return `Page "${id}" not found`;
}

/**
 * One tab per page (always shown, even for a single page); only the selected
 * page's content is rendered. Clicking a link opens the target page's tab, or
 * shows a toast if there is no such page.
 */
export function PageTabs({
  pages,
  selectedIndex,
  onSelect,
}: {
  pages: Page[];
  selectedIndex: number;
  onSelect: (index: number) => void;
}) {
  const selected = resolveSelectedIndex(selectedIndex, pages.length);
  const onLink = (id: string) => {
    const resolution = resolveLink(pages, id);
    if ("index" in resolution) onSelect(resolution.index);
    else toast.error(linkNotFoundMessage(resolution.notFound));
  };
  return (
    <Tabs value={selected} onValueChange={(value) => onSelect(Number(value))} className="min-h-0 flex-1">
      <TabsList aria-label="Pages" className="h-auto max-w-full flex-none flex-wrap">
        {pages.map((page, index) => (
          <TabsTrigger key={index} value={index}>
            {pageLabel(page, index)}
          </TabsTrigger>
        ))}
      </TabsList>
      <TabsContent value={selected} data-page-index={selected} className="min-h-0 overflow-y-auto">
        <div className="flex flex-col gap-2">
          {pages[selected]!.children.map((child, index) => (
            <WireframeNode key={index} node={child} onLink={onLink} path={[index]} />
          ))}
        </div>
      </TabsContent>
    </Tabs>
  );
}
