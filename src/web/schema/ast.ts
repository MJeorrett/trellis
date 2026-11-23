import { z } from "zod";

/**
 * Trellis Wireframe AST schema.
 * Source of truth: /capabilities/trellis-ast/capability.md
 */

/**
 * Component primitives. `Text` is identical to `Box` except it renders without a border.
 * `Row` is a borderless row: its children are laid out on a single row.
 * `BoxRow` is a `Row` with a border (like `Box` is to `Text`).
 * `Spacer` is invisible and fills the remaining space of its parent `Row` or `BoxRow`; it is only
 * valid as a direct child of one of them (checked by `AstSchema`).
 * `Image` is a picture placeholder, drawn as a `Box` with an X through it; it has no text, children, font or font size (checked by `AstSchema`).
 * `Page` is not a node type: it is the separate, root-only `PageSchema`.
 */
export const NodeTypeSchema = z.enum(["Box", "Text", "Row", "BoxRow", "Spacer", "Image"]);
export type NodeType = z.infer<typeof NodeTypeSchema>;

/** Pattern of page ids and link targets (`id=` / `link-to=` values in the syntax). */
export const ID_PATTERN = /^[A-Za-z0-9_-]+$/;
export const IdSchema = z.string().regex(ID_PATTERN);

/** A node's relative width inside a `Row`, in twelfths of the row: a whole number from 1 to 12. */
export const WidthSchema = z.number().int().min(1).max(12);

/** An `Image`'s aspect ratio, written `W:H` with each part a whole number from 1 to 99 (no sign or leading zero). */
export const ASPECT_RATIO_PATTERN = /^[1-9]\d?:[1-9]\d?$/;
export const AspectRatioSchema = z.string().regex(ASPECT_RATIO_PATTERN);

/** The font weight of a node's own text. `bold` is the only value; without `font` the weight is normal. */
export const FontSchema = z.literal("bold");

/** The size of a node's own text. `md` is the default (the viewer's look when `fontSize` is absent). */
export const FontSizeSchema = z.enum(["sm", "md", "lg"]);

/** The data dictionary columns a pointer can show: `mock` is the row's `mockValue`, the others are the column of that name. */
export const POINTER_KINDS = ["entity", "field", "dataType", "label", "mock"] as const;
export type PointerKind = (typeof POINTER_KINDS)[number];

/**
 * A reference from a node's text to a field of the data dictionary (`@Entity.Field.label`), before it is resolved.
 * `line` is the 1-based line of the text the core parser saw, so the resolver can report it.
 */
export const PointerRefSchema = z.strictObject({
  entity: z.string(),
  field: z.string(),
  kind: z.enum(POINTER_KINDS),
  line: z.number().int().min(1),
});
export type PointerRef = z.infer<typeof PointerRefSchema>;

/** A single node in the UI tree. Recursive via `children`. Unknown keys are rejected. */
export const AstNodeSchema = z.strictObject({
  /** The component primitive. */
  type: NodeTypeSchema,
  /** Optional: draws the node's own text in bold (not inherited). The syntax rejects it on `Spacer`. Omitted when not written. */
  font: FontSchema.optional(),
  /** Optional: the size of the node's own text (not inherited; `md` is the default). The syntax rejects it on `Spacer`. Omitted when not written. */
  fontSize: FontSizeSchema.optional(),
  /** Optional: the node's width in twelfths of its parent `Row` (no effect outside a `Row`). Omitted when not written. */
  width: WidthSchema.optional(),
  /** Optional: the `id` of the page to open when the node is clicked. The syntax only allows it on `Box`, `Text` and `Image`. */
  linkTo: IdSchema.optional(),
  /** Optional, `Image` only (checked by `AstSchema`): its shape as `W:H`, e.g. `1:1`. Omitted when not written. */
  aspectRatio: AspectRatioSchema.optional(),
  /** Text content of the node (applies to both `Box` and `Text`). May be empty. */
  text: z.string(),
  /** Optional: the data dictionary field the text is taken from, with `text` empty until it is resolved. Never present in a resolved AST. */
  ref: PointerRefSchema.optional(),
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
 * Reports the structural rules of `Spacer` and `Image` for the nodes in `children` (and, recursively, below):
 * a `Spacer` must be a direct child of a `Row` or `BoxRow`, with no text, children, link or font attributes;
 * an `Image` has no text, children, font or font size (it may have `linkTo`, `width` and `aspectRatio`);
 * no other node may have an `aspectRatio`.
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
      if (parent !== "Row" && parent !== "BoxRow") issue("Spacer must be inside a Row or BoxRow");
      if (node.text !== "" || node.ref !== undefined) issue("Spacer cannot have text");
      if (node.linkTo !== undefined) issue("Spacer cannot have link-to");
      if (node.font !== undefined) issue("Spacer cannot have font");
      if (node.fontSize !== undefined) issue("Spacer cannot have font-size");
      if (node.children.length > 0) issue("Spacer cannot have children");
    }
    if (node.type === "Image") {
      const issue = (message: string) => ctx.addIssue({ code: "custom", path: nodePath, message });
      if (node.text !== "" || node.ref !== undefined) issue("Image cannot have text");
      if (node.font !== undefined) issue("Image cannot have font");
      if (node.fontSize !== undefined) issue("Image cannot have font-size");
      if (node.children.length > 0) issue("Image cannot have children");
    }
    if (node.aspectRatio !== undefined && node.type !== "Image") {
      ctx.addIssue({ code: "custom", path: nodePath, message: `${node.type} cannot have aspect-ratio` });
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
