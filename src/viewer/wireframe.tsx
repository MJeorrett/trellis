import type { KeyboardEvent, MouseEvent } from "react";
import type { AstNode } from "@/schema/ast";
import { cn } from "@/lib/utils";

/**
 * Recursively renders an AST node as a wireframe.
 * `Box` renders with a border; `Text` is identical but borderless; `Row` is
 * bordered like `Box` but lays its children out on a single, non-wrapping row
 * (see /capabilities/trellis-ast/capability.md).
 *
 * A node with `linkTo` is a link: it shows a pointer cursor and calls `onLink`
 * with its target page id when clicked (or activated with Enter). Only the
 * innermost link of nested links fires.
 */
export function WireframeNode({ node, onLink }: { node: AstNode; onLink?: (target: string) => void }) {
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
      {...linkProps}
    >
      {node.text !== "" && <span>{node.text}</span>}
      {node.children.map((child, index) => (
        <WireframeNode key={index} node={child} onLink={onLink} />
      ))}
    </div>
  );
}
