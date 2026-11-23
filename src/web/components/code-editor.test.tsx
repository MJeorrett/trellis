import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CodeEditor } from "./code-editor";

const render = (props: {
  value: string;
  readOnly?: boolean;
  ariaLabel?: string;
  placeholder?: string;
  className?: string;
}) =>
  renderToStaticMarkup(
    <CodeEditor ariaLabel={props.ariaLabel ?? "Source"} value={props.value} readOnly={props.readOnly} placeholder={props.placeholder} className={props.className} />,
  );

const editor = (html: string, label = "Source") =>
  new RegExp(
    `<div(?=[^>]*data-slot="code-editor")(?=[^>]*aria-label="${label}")[^>]*>([\\s\\S]*)</div>`,
  ).exec(html);

const valueOf = (html: string, label = "Source") =>
  new RegExp(
    `<div(?=[^>]*data-slot="code-editor")(?=[^>]*aria-label="${label}")[^>]*>[\\s\\S]*?<pre[^>]*>([\\s\\S]*?)</pre>`,
  ).exec(html)?.[1];

describe("CodeEditor static markup", () => {
  it("names its container with the ariaLabel and shows the value as text", () => {
    const html = render({ value: 'Page "Log in" id=login' });
    expect(editor(html)).not.toBeNull();
    expect(valueOf(html)).toBe('Page &quot;Log in&quot; id=login');
  });

  it("shows an empty value as empty text", () => {
    expect(valueOf(render({ value: "" }))).toBe("");
  });

  it("marks a read-only editor", () => {
    const html = render({ value: "Page", readOnly: true });
    expect(editor(html)?.[0]).toContain("data-readonly");
    expect(valueOf(html)).toBe("Page");
  });

  it("applies className to the container", () => {
    const html = render({ value: "", className: "min-h-48 flex-1" });
    expect(editor(html)?.[0]).toMatch(/class="[^"]*\bmin-h-48\b[^"]*\bflex-1\b/);
  });
});
