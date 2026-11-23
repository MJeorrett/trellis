import { StreamLanguage, StringStream } from "@codemirror/language";
import { tagHighlighter, tags } from "@lezer/highlight";

type Stream = StringStream;

const trellisToken = (stream: Stream): string | null => {
  if (stream.sol() && stream.peek() === "#") {
    stream.skipToEnd();
    return "comment";
  }
  if (stream.eatSpace()) return null;
  if (stream.match(/^"[^"]*"/)) return "string";
  if (stream.match(/^@[A-Za-z][\w.]*/)) return "variableName.special";
  if (stream.match(/^\$(?:1(?![A-Za-z0-9_])|[A-Za-z]\w*(?:\.[A-Za-z]\w*)*)/)) return "variableName";
  if (stream.match(/^(?:Def|Each)\b/)) return "keyword";
  if (stream.match(/^[A-Z][A-Za-z0-9]*/)) return "typeName";
  if (stream.match(/^[a-z][\w-]*(?:\.[a-z]\w*)*=(?:[A-Za-z][\w-]*|\d+(?::\d+)?)?/)) return "attributeName";
  if (stream.match(/^\d+/)) return "number";
  if (stream.match(/^[A-Za-z_][\w-]*/)) return null;
  stream.next();
  return null;
};

export const trellisLanguage = StreamLanguage.define<null>({
  name: "trellis",
  startState: () => null,
  token: trellisToken,
});

export type TokenPiece = { text: string; token: string | null };

export function tokenizeLine(line: string): TokenPiece[] {
  const stream = new StringStream(line, 2, 2);
  const pieces: TokenPiece[] = [];
  while (!stream.eol()) {
    stream.start = stream.pos;
    const token = trellisToken(stream);
    const text = line.slice(stream.start, stream.pos);
    const last = pieces.at(-1);
    if (token === null && last?.token === null) last.text += text;
    else pieces.push({ text, token });
  }
  return pieces;
}

export const trellisHighlighter = tagHighlighter([
  { tag: tags.comment, class: "tok-comment" },
  { tag: tags.string, class: "tok-string" },
  { tag: tags.special(tags.variableName), class: "tok-pointer" },
  { tag: tags.variableName, class: "tok-parameter" },
  { tag: tags.keyword, class: "tok-keyword" },
  { tag: tags.typeName, class: "tok-type" },
  { tag: tags.attributeName, class: "tok-attribute" },
  { tag: tags.number, class: "tok-number" },
]);
