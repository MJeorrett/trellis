import { z } from "zod";

/**
 * Trellis Wireframe AST schema.
 * Source of truth: /capabilities/trellis-ast/capability.md
 */

/**
 * Component primitives. `Text` is identical to `Box` except it renders without a border.
 * `Row` is identical to `Box` except its children are laid out on a single row.
 * `Page` is not a node type: it is the separate, root-only `PageSchema`.
 */
export const NodeTypeSchema = z.enum(["Box", "Text", "Row"]);
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

/** One complete page of the wire frame. Only valid at the root, never nested. */
export const PageSchema = z.strictObject({
  /** The page title, used by the viewer as the tab label. May be empty. */
  title: z.string(),
  /** The page's top-level nodes. Use an empty array for a blank page. */
  children: z.array(AstNodeSchema),
});

export type Page = z.infer<typeof PageSchema>;

/** A complete wireframe AST: one or more pages. */
export const AstSchema = z.strictObject({
  pages: z.array(PageSchema).min(1),
});

export type Ast = z.infer<typeof AstSchema>;
