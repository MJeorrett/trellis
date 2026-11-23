/**
 * A comment line: its first character is `#`. It is ignored like a blank line, by the macro preprocessor and the
 * core parser alike. Rules: /capabilities/trellis-ast/capability.md (`CI-023 Comments (planned)`).
 */
export const isCommentLine = (line: string): boolean => line.startsWith("#");
