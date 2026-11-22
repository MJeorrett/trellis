import type { CSSProperties, KeyboardEvent, MouseEvent } from "react";
import type { AstNode } from "@/schema/ast";
import { cn } from "@/lib/utils";
import { seedFromPath, sketchStyle } from "./sketch";

/** The handwriting font (a system font, not bundled), applied only to wire frame nodes. */
const SKETCH_FONT = "'Segoe Print', cursive, sans-serif";

/**
 * Recursively renders an AST node as a wireframe.
 * `Box` renders with a border; `Text` is identical but borderless; `Row` is
 * bordered like `Box` but lays its children out on a single, non-wrapping row
 * (see /capabilities/trellis-ast/capability.md).
 *
 * A node with `linkTo` is a link: it shows a pointer cursor and calls `onLink`
 * with its target page id when clicked (or activated with Enter). Only the
 * innermost link of nested links fires.
 *
 * Nodes are drawn like a hand-drawn sketch: a handwriting font, plus a tiny tilt
 * and (for bordered nodes) wobbly corners from `sketchStyle`. The look is seeded
 * by `path` (the node's child-index path from the page root, empty by default),
 * never by its text, so editing text does not change any node's look.
 */
export function WireframeNode({
  node,
  onLink,
  path = [],
}: {
  node: AstNode;
  onLink?: (target: string) => void;
  path?: readonly number[];
}) {
  const sketch = sketchStyle(seedFromPath(path));
  const style: CSSProperties = {
    fontFamily: SKETCH_FONT,
    transform: sketch.transform,
    ...(node.type !== "Text" && { borderRadius: sketch.borderRadius }),
  };
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
        "flex gap-2 p-2 text-sm",
        node.type === "Row" ? "flex-row flex-nowrap" : "flex-col",
        node.type !== "Text" && "border border-foreground/60",
        linkTo !== undefined && "cursor-pointer",
      )}
      style={style}
      {...linkProps}
    >
      {node.text !== "" && <span>{node.text}</span>}
      {node.children.map((child, index) => (
        <WireframeNode key={index} node={child} onLink={onLink} path={[...path, index]} />
      ))}
    </div>
  );
}
