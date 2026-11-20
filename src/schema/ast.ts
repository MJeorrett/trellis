import { z } from "zod";

/**
 * Trellis Wireframe AST schema.
 * Source of truth: /capabilities/trellis-ast/capability.md
 */

/** Component primitives. `Text` is identical to `Box` except it renders without a border. */
export const NodeTypeSchema = z.enum(["Box", "Text"]);
export type NodeType = z.infer<typeof NodeTypeSchema>;

/** A single node in the UI tree. Recursive via `children`. Unknown keys are rejected. */
export const AstNodeSchema = z.strictObject({
  /** Unique identifier for the node (uniqueness across the tree is enforced by `AstSchema`). */
  id: z.string().min(1),
  /** The component primitive. */
  type: NodeTypeSchema,
  /** Text content of the node (applies to both `Box` and `Text`). May be empty. */
  text: z.string(),
  /** Nested nodes. Use an empty array for leaf nodes. */
  get children() {
    return z.array(AstNodeSchema);
  },
});

export type AstNode = z.infer<typeof AstNodeSchema>;

function collectDuplicateIds(node: AstNode, seen: Set<string>, dupes: Set<string>): void {
  if (seen.has(node.id)) {
    dupes.add(node.id);
  }
  seen.add(node.id);
  for (const child of node.children) {
    collectDuplicateIds(child, seen, dupes);
  }
}

/** A complete wireframe AST: a single root node whose `id`s are unique across the whole tree. */
export const AstSchema = AstNodeSchema.superRefine((root, ctx) => {
  const dupes = new Set<string>();
  collectDuplicateIds(root, new Set(), dupes);
  for (const id of dupes) {
    ctx.addIssue({
      code: "custom",
      message: `Duplicate node id: "${id}"`,
    });
  }
});

export type Ast = z.infer<typeof AstSchema>;
