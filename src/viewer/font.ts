import type { AstNode } from "@/schema/ast";

/** The Tailwind size class of a node's own text: `md` (and no `fontSize`) is today's `text-sm`. */
export function fontSizeClass(fontSize: AstNode["fontSize"]): string {
  switch (fontSize) {
    case "sm":
      return "text-xs";
    case "lg":
      return "text-3xl";
    default:
      return "text-base";
  }
}

/** The weight class of a node's own text; `font-normal` resets a weight inherited from the parent. */
export function fontWeightClass(font: AstNode["font"]): string {
  return font === "bold" ? "font-bold" : "font-normal";
}
