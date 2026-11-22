import { z } from "zod";

/**
 * Trellis Wireframe AST schema.
 * Source of truth: /capabilities/trellis-ast/capability.md
 */

/**
 * Component primitives. `Text` is identical to `Box` except it renders without a border.
 * `Row` is identical to `Box` except its children are laid out on a single row.
 * `Spacer` is invisible and fills the remaining space of its parent `Row`; it is only
 * valid as a direct child of a `Row` (checked by `AstSchema`).
 * `Page` is not a node type: it is the separate, root-only `PageSchema`.
 */
export const NodeTypeSchema = z.enum(["Box", "Text", "Row", "Spacer"]);
export type NodeType = z.infer<typeof NodeTypeSchema>;

/** Pattern of page ids and link targets (`id=` / `link-to=` values in the syntax). */
export const ID_PATTERN = /^[A-Za-z0-9_-]+$/;
export const IdSchema = z.string().regex(ID_PATTERN);

/** A single node in the UI tree. Recursive via `children`. Unknown keys are rejected. */
export const AstNodeSchema = z.strictObject({
  /** The component primitive. */
  type: NodeTypeSchema,
  /** Optional: the `id` of the page to open when the node is clicked. The syntax only allows it on `Box` and `Text`. */
  linkTo: IdSchema.optional(),
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
  /** Optional identifier (unique across pages), the target of links. */
  id: IdSchema.optional(),
  /** The page title, used by the viewer as the tab label. May be empty. */
  title: z.string(),
  /** The page's top-level nodes. Use an empty array for a blank page. */
  children: z.array(AstNodeSchema),
});

export type Page = z.infer<typeof PageSchema>;

/**
 * Reports the structural rules of `Spacer` for the nodes in `children` (and, recursively, below):
 * it must be a direct child of a `Row`, with no text, children or link.
 */
function checkSpacers(
  children: readonly AstNode[],
  parent: "Page" | AstNode["type"],
  path: (string | number)[],
  ctx: z.RefinementCtx,
) {
  children.forEach((node, index) => {
    const nodePath = [...path, index];
    if (node.type === "Spacer") {
      const issue = (message: string) => ctx.addIssue({ code: "custom", path: nodePath, message });
      if (parent !== "Row") issue("Spacer must be inside a Row");
      if (node.text !== "") issue("Spacer cannot have text");
      if (node.linkTo !== undefined) issue("Spacer cannot have link-to");
      if (node.children.length > 0) issue("Spacer cannot have children");
    }
    checkSpacers(node.children, node.type, [...nodePath, "children"], ctx);
  });
}

/** A complete wireframe AST: one or more pages. */
export const AstSchema = z
  .strictObject({
    pages: z.array(PageSchema).min(1),
  })
  .superRefine((ast, ctx) => {
    ast.pages.forEach((page, index) => checkSpacers(page.children, "Page", ["pages", index, "children"], ctx));

    const seen = new Set<string>();
    ast.pages.forEach((page, index) => {
      if (page.id === undefined) return;
      if (seen.has(page.id)) {
        ctx.addIssue({
          code: "custom",
          path: ["pages", index, "id"],
          message: `Duplicate page id "${page.id}"`,
        });
      }
      seen.add(page.id);
    });
  });

export type Ast = z.infer<typeof AstSchema>;
