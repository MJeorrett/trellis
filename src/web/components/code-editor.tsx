import { defaultKeymap, history, historyKeymap, insertNewlineKeepIndent } from "@codemirror/commands";
import { syntaxHighlighting } from "@codemirror/language";
import { Annotation, EditorState, type Extension } from "@codemirror/state";
import {
  drawSelection,
  EditorView,
  keymap,
  lineNumbers,
  placeholder as placeholderText,
  type KeyBinding,
} from "@codemirror/view";
import { cn } from "cn";
import { useEffect, useRef, useState } from "react";
import { trellisHighlighter, trellisLanguage } from "@/syntax/highlight";

const fromProps = Annotation.define<boolean>();

const selection = "color-mix(in oklab, var(--ring) 35%, transparent)";

const withoutTab = (bindings: readonly KeyBinding[]) =>
  bindings.filter((binding) => binding.key !== "Tab" && binding.key !== "Shift-Tab");

const theme = EditorView.theme({
  "&": { height: "100%", backgroundColor: "transparent", color: "inherit", fontSize: "inherit" },
  "&.cm-focused": { outline: "none" },
  ".cm-scroller": { fontFamily: "inherit", lineHeight: "1.5", overflow: "auto" },
  ".cm-content": { padding: "8px 0", caretColor: "var(--foreground)" },
  ".cm-line": { padding: "0 10px" },
  ".cm-cursor, .cm-dropCursor": { borderLeftColor: "var(--foreground)" },
  ".cm-selectionBackground": { backgroundColor: selection },
  "&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground": { backgroundColor: selection },
  ".cm-content ::selection": { backgroundColor: selection },
  ".cm-placeholder": { color: "var(--muted-foreground)", whiteSpace: "pre-wrap" },
  ".cm-gutters": {
    backgroundColor: "transparent",
    color: "var(--muted-foreground)",
    border: "none",
    borderRight: "1px solid var(--border)",
    userSelect: "none",
  },
  ".cm-lineNumbers .cm-gutterElement": { padding: "0 8px 0 10px", minWidth: "2ch" },
});

function extensionsFor(readOnly: boolean, ariaLabel: string, placeholder: string | undefined): Extension[] {
  return [
    lineNumbers(),
    drawSelection(),
    history(),
    keymap.of([
      { key: "Enter", run: insertNewlineKeepIndent },
      ...withoutTab(defaultKeymap),
      ...withoutTab(historyKeymap),
    ]),
    trellisLanguage,
    syntaxHighlighting(trellisHighlighter),
    theme,
    EditorView.contentAttributes.of({
      "aria-label": ariaLabel,
      spellcheck: "false",
      ...(readOnly ? { "aria-readonly": "true" } : {}),
    }),
    ...(placeholder === undefined ? [] : [placeholderText(placeholder)]),
    ...(readOnly ? [EditorState.readOnly.of(true), EditorView.editable.of(false)] : [EditorView.lineWrapping]),
  ];
}

/**
 * The highlighted source editor, controlled by `value`. `onChange` is called for edits made in the editor only,
 * never for a change of `value`.
 */
export function CodeEditor({
  value,
  onChange,
  readOnly = false,
  ariaLabel,
  placeholder,
  className,
}: {
  value: string;
  onChange?: (value: string) => void;
  readOnly?: boolean;
  ariaLabel: string;
  placeholder?: string;
  className?: string;
}) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const latestValue = useRef(value);
  const latestOnChange = useRef(onChange);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    latestValue.current = value;
    latestOnChange.current = onChange;
  });

  useEffect(() => {
    const created = new EditorView({
      parent: host.current!,
      state: EditorState.create({
        doc: latestValue.current,
        extensions: [
          extensionsFor(readOnly, ariaLabel, placeholder),
          EditorView.updateListener.of((update) => {
            if (update.docChanged && !update.transactions.some((transaction) => transaction.annotation(fromProps))) {
              latestOnChange.current?.(update.state.doc.toString());
            }
          }),
        ],
      }),
    });
    view.current = created;
    setMounted(true);
    return () => {
      created.destroy();
      view.current = null;
    };
  }, [readOnly, ariaLabel, placeholder]);

  useEffect(() => {
    const current = view.current;
    if (current === null || current.state.doc.toString() === value) return;
    current.dispatch({
      changes: { from: 0, to: current.state.doc.length, insert: value },
      annotations: fromProps.of(true),
    });
  }, [value]);

  return (
    <div
      role="group"
      aria-label={ariaLabel}
      data-slot="code-editor"
      data-placeholder={placeholder}
      {...(readOnly ? { "data-readonly": "" } : {})}
      className={cn(
        "flex min-w-0 flex-col overflow-hidden rounded-lg border border-input bg-transparent font-mono text-xs dark:bg-input/30",
        !readOnly && "transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50",
        className,
      )}
    >
      <div ref={host} className="h-full min-h-0 min-w-0" />
      {/* Only until the editor mounts: it is what the static markup holds, since effects do not run there. */}
      {!mounted && <pre className="whitespace-pre-wrap px-2.5 py-2">{value}</pre>}
    </div>
  );
}
