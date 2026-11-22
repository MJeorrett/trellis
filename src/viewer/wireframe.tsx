import type { CSSProperties, KeyboardEvent, MouseEvent } from "react";
import type { AstNode } from "@/schema/ast";
import { cn } from "@/lib/utils";
import { fontSizeClass, fontWeightClass } from "./font";
import { rowWidths } from "./layout";
import { seedFromPath, sketchStyle } from "./sketch";

/** The handwriting font (a system font, not bundled), applied only to wire frame nodes. */
const SKETCH_FONT = "'Segoe Print', cursive, sans-serif";

/** The aspect ratio of an `Image` that does not write one (a square). Not written back to the AST. */
const DEFAULT_ASPECT_RATIO = "1:1";

/** The gap between a node's children, in rem (the `gap-2` class). */
const GAP_REM = 0.5;

/** A child's place in a `Row` with widths: its width in twelfths and the row's child count. */
type RowSlot = { width: number; count: number };

/** N/12 of the row's inner width after its gaps, so widths adding up to 12 fill the row exactly. */
function slotBasis({ width, count }: RowSlot): string {
  return `calc((100% - ${(count - 1) * GAP_REM}rem) * ${width} / 12)`;
}

/**
 * Recursively renders an AST node as a wireframe.
 * `Box` renders with a border; `Text` is identical but borderless; `BoxRow` is
 * bordered like `Box` but lays its children out on a single, non-wrapping row,
 * and `Row` is the same row without the border (see /capabilities/trellis-ast/capability.md).
 * `Spacer` is an empty `flex-1` element that takes the remaining space of its
 * parent `Row` or `BoxRow`. `Image` is a bordered `Box`-like element with an X drawn corner to
 * corner and no text or children. Its height follows from its width through its `aspectRatio`
 * (`1:1` by default) with a minimum width of 6rem, and `inRow` (set by a `Row` or `BoxRow` for
 * its children) stops the row from stretching it.
 *
 * A node with `linkTo` is a link: it shows a pointer cursor and calls `onLink`
 * with its target page id when clicked (or activated with Enter). Only the
 * innermost link of nested links fires.
 *
 * Nodes are drawn like a hand-drawn sketch: a handwriting font, plus a tiny tilt
 * and (for bordered nodes) wobbly corners from `sketchStyle`. The look is seeded
 * by `path` (the node's child-index path from the page root, empty by default),
 * never by its text, so editing text does not change any node's look.
 *
 * `font` and `fontSize` style the node's own text only: every node sets its own size class
 * and weight (`font-normal` unless bold), so nothing is inherited from its parent.
 *
 * `slot` is set by a parent `Row` that has widths (see `rowWidths`): the child's resolved
 * width in twelfths and the number of children of the row. The child then gets a fixed
 * flex basis of that share of the row's inner width (after the gaps). A `Spacer` with a
 * slot is a fixed-width gap instead of a filler.
 */
export function WireframeNode({
  node,
  onLink,
  path = [],
  slot,
  inRow = false,
}: {
  node: AstNode;
  onLink?: (target: string) => void;
  path?: readonly number[];
  slot?: RowSlot;
  inRow?: boolean;
}) {
  const slotStyle: CSSProperties | undefined = slot && {
    flex: `0 0 ${slotBasis(slot)}`,
    minWidth: 0,
  };

  // A Spacer is invisible: it grows to fill the remaining space of its parent Row,
  // unless the row has widths, in which case it is a gap of its own width.
  if (node.type === "Spacer") {
    return slotStyle ? (
      <div data-node-type="Spacer" style={slotStyle} />
    ) : (
      <div data-node-type="Spacer" className="flex-1" />
    );
  }

  // `Row` and `BoxRow` lay their children out on a row; every type except `Text` and `Row` has a border.
  const isRow = node.type === "Row" || node.type === "BoxRow";
  const hasBorder = node.type !== "Text" && node.type !== "Row";
  // An `Image` is a bordered box with an X through it: a placeholder for a picture.
  const isImage = node.type === "Image";
  // An `Image` gets its height from its width through its aspect ratio (1:1 when not written), so it
  // has no minimum height: the 6rem minimum width already gives a 6rem square at the smallest.
  const aspectRatio = isImage ? (node.aspectRatio ?? DEFAULT_ASPECT_RATIO).replace(":", " / ") : undefined;

  const sketch = sketchStyle(seedFromPath(path));
  const style: CSSProperties = {
    fontFamily: SKETCH_FONT,
    transform: sketch.transform,
    ...(hasBorder && { borderRadius: sketch.borderRadius }),
    ...(aspectRatio !== undefined && { aspectRatio }),
    ...slotStyle,
  };
  // Only a Row or BoxRow lays its children out by width; anywhere else `width` has no effect.
  const widths = isRow ? rowWidths(node.children) : [];
  const linkTo = node.linkTo;
  const linkProps =
    linkTo === undefined
      ? {}
      : {
          role: "link",
          tabIndex: 0,
          "data-link-to": linkTo,
          onClick: (event: MouseEvent) => {
            event.stopPropagation();
            onLink?.(linkTo);
          },
          onKeyDown: (event: KeyboardEvent) => {
            if (event.key !== "Enter" || event.target !== event.currentTarget) return;
            event.stopPropagation();
            onLink?.(linkTo);
          },
        };

  return (
    <div
      data-node-type={node.type}
      className={cn(
        "flex gap-2 p-2",
        fontSizeClass(node.fontSize),
        fontWeightClass(node.font),
        isRow ? "flex-row flex-nowrap" : "flex-col",
        hasBorder && "border border-foreground/60",
        isImage && "relative min-w-24",
        // In a row, keep the height given by the ratio instead of stretching to the tallest sibling.
        isImage && inRow && "self-start",
        linkTo !== undefined && "cursor-pointer",
      )}
      style={style}
      {...linkProps}
    >
      {isImage && (
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 h-full w-full text-foreground/60"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
        >
          <line x1="0" y1="0" x2="100" y2="100" stroke="currentColor" vectorEffect="non-scaling-stroke" />
          <line x1="0" y1="100" x2="100" y2="0" stroke="currentColor" vectorEffect="non-scaling-stroke" />
        </svg>
      )}
      {node.text !== "" && <span>{node.text}</span>}
      {node.children.map((child, index) => {
        const width = widths[index];
        return (
          <WireframeNode
            key={index}
            node={child}
            onLink={onLink}
            path={[...path, index]}
            slot={width === undefined ? undefined : { width, count: node.children.length }}
            inRow={isRow}
          />
        );
      })}
    </div>
  );
}
