import type { AstNode } from "@/schema/ast";
import { cn } from "@/lib/utils";

/**
 * Recursively renders an AST node as a wireframe.
 * `Box` renders with a border; `Text` is identical but borderless
 * (see /capabilities/trellis-ast/capability.md).
 */
export function WireframeNode({ node }: { node: AstNode }) {
  return (
    <div
      data-node-type={node.type}
      className={cn(
        "flex flex-col gap-2 p-2 text-sm",
        node.type === "Box" && "border border-foreground/60",
      )}
    >
      {node.text !== "" && <span>{node.text}</span>}
      {node.children.map((child, index) => (
        <WireframeNode key={index} node={child} />
      ))}
    </div>
  );
}
