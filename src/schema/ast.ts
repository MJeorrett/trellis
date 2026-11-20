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

/** A complete wireframe AST: a single root node. */
export const AstSchema = AstNodeSchema;

export type Ast = z.infer<typeof AstSchema>;
