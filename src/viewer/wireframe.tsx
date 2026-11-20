import type { AstNode } from "@/schema/ast";
import { cn } from "@/lib/utils";

/**
 * Recursively renders an AST node as a wireframe.
 * `Box` renders with a border; `Text` is identical but borderless; `Row` is
 * bordered like `Box` but lays its children out on a single, non-wrapping row
 * (see /capabilities/trellis-ast/capability.md).
 */
export function WireframeNode({ node }: { node: AstNode }) {
  return (
    <div
      data-node-type={node.type}
      className={cn(
        "flex gap-2 p-2 text-sm",
        node.type === "Row" ? "flex-row flex-nowrap" : "flex-col",
        node.type !== "Text" && "border border-foreground/60",
      )}
    >
      {node.text !== "" && <span>{node.text}</span>}
      {node.children.map((child, index) => (
        <WireframeNode key={index} node={child} />
      ))}
    </div>
  );
}
