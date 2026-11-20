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

/**
 * One tab per page (always shown, even for a single page); only the selected
 * page's content is rendered.
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
  return (
    <Tabs value={selected} onValueChange={(value) => onSelect(Number(value))}>
      <TabsList aria-label="Pages" className="h-auto max-w-full flex-wrap">
        {pages.map((page, index) => (
          <TabsTrigger key={index} value={index}>
            {pageLabel(page, index)}
          </TabsTrigger>
        ))}
      </TabsList>
      <TabsContent value={selected} data-page-index={selected}>
        <div className="flex flex-col gap-2">
          {pages[selected]!.children.map((child, index) => (
            <WireframeNode key={index} node={child} />
          ))}
        </div>
      </TabsContent>
    </Tabs>
  );
}
