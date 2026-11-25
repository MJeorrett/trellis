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

const insertTwoSpaces = ({ state, dispatch }: EditorView): boolean => {
  if (state.readOnly) return false;
  dispatch(state.update(state.replaceSelection("  "), { scrollIntoView: true, userEvent: "input" }));
  return true;
};

const removeTwoSpaces = ({ state, dispatch }: EditorView): boolean => {
  if (state.readOnly) return false;
  const changes: { from: number; to: number }[] = [];
  let lastLine = -1;
  for (const range of state.selection.ranges) {
    const first = state.doc.lineAt(range.from).number;
    const last = state.doc.lineAt(range.to).number;
    for (let number = Math.max(first, lastLine + 1); number <= last; number++) {
      const line = state.doc.line(number);
      const spaces = /^ {1,2}/.exec(line.text)?.[0].length ?? 0;
      if (spaces > 0) changes.push({ from: line.from, to: line.from + spaces });
    }
    lastLine = Math.max(lastLine, last);
  }
  if (changes.length > 0) dispatch(state.update({ changes, scrollIntoView: true, userEvent: "delete.dedent" }));
  return true;
};

// The clipboard cannot carry a "this was a whole line" flag, so the last whole-line copy is remembered to paste it
// above the cursor's line, as VS Code does, instead of splitting the line at the cursor.
// A comment only counts at column 0, so unlike CodeMirror's toggleComment this never puts the `#` after the indentation.
const toggleComment = ({ state, dispatch }: EditorView): boolean => {
  if (state.readOnly) return false;
  const lines: { from: number; text: string }[] = [];
  let lastLine = 0;
  for (const range of state.selection.ranges) {
    const first = state.doc.lineAt(range.from).number;
    let last = state.doc.lineAt(range.to).number;
    if (last > first && range.to === state.doc.line(last).from) last--;
    for (let number = Math.max(first, lastLine + 1); number <= last; number++) {
      const line = state.doc.line(number);
      if (line.text.trim() !== "") lines.push({ from: line.from, text: line.text });
    }
    lastLine = Math.max(lastLine, last);
  }
  if (lines.length === 0) return true;
  const uncomment = lines.every((line) => line.text.startsWith("#"));
  const changes = lines.map((line) =>
    uncomment
      ? { from: line.from, to: line.from + (line.text.startsWith("# ") ? 2 : 1) }
      : { from: line.from, insert: "# " },
  );
  dispatch(state.update({ changes, scrollIntoView: true, userEvent: "input.comment" }));
  return true;
};

let lastLineCopy: string | null = null;

const wholeLineCopyAndPaste = EditorView.domEventHandlers({
  copy(event, { state }) {
    if (!state.selection.ranges.every((range) => range.empty) || event.clipboardData === null) return false;
    const lines = [...new Set(state.selection.ranges.map((range) => state.doc.lineAt(range.head).number))];
    lastLineCopy = lines.map((number) => `${state.doc.line(number).text}\n`).join("");
    event.clipboardData.setData("text/plain", lastLineCopy);
    event.preventDefault();
    return true;
  },
  paste(event, view) {
    const { state } = view;
    if (lastLineCopy === null || event.clipboardData?.getData("text/plain") !== lastLineCopy) return false;
    if (!state.selection.ranges.every((range) => range.empty)) return false;
    const starts = [...new Set(state.selection.ranges.map((range) => state.doc.lineAt(range.head).from))];
    const changes = state.changes(starts.map((from) => ({ from, insert: lastLineCopy! })));
    view.dispatch({
      changes,
      selection: state.selection.map(changes, 1),
      scrollIntoView: true,
      userEvent: "input.paste",
    });
    event.preventDefault();
    return true;
  },
});

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
      { key: "Tab", run: insertTwoSpaces },
      { key: "Shift-Tab", run: removeTwoSpaces },
      { key: "Mod-/", run: toggleComment },
      ...withoutTab(defaultKeymap),
      ...withoutTab(historyKeymap),
    ]),
    wholeLineCopyAndPaste,
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
