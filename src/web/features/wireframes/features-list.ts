/**
 * The source lines that the sketched `Feature detail` page shows in its "Wire frame source" pane, as the
 * selected page tab's text area holds them: the page's own `Page` line, then its nodes at 2 spaces.
 * Quotes are curly because the syntax has no way to escape a straight quote inside a text.
 */
const logInLines = [
  "Page “Log in” id=login",
  "  Box",
  "    Text “Log in” font=bold font-size=lg",
  "    Box",
  "      Text “Email” font=bold",
  "      Box “you@example.com”",
  "    Box",
  "      Text “Password” font=bold",
  "      Box “*********”",
  "    Text “Forgot password?” link-to=forgot font-size=sm",
  "    Row",
  "      Box “Cancel”",
  "      Spacer",
  "      Box “Submit”",
];

/** Turns shown source lines into `Text` nodes, with leading spaces as non-breaking spaces so the preview keeps the indentation. */
const sourceLineNodes = (lines: string[]) =>
  lines
    .map((line) => `        Text "${line.replace(/^ +/, (spaces) => "\u00a0".repeat(spaces.length))}"`)
    .join("\n");

/** Blank `Text` lines under the source, so the sketched text area is taller than its content. */
const blankLines = "        Text\n".repeat(5).trimEnd();

/**
 * Wire frame source of the `Features list` feature: the Features page (a list of features with a
 * create button), the Create feature dialog and the Feature detail page, linked to each other.
 */
export const featuresListSource = `Page "Features" id=features
  Row
    Text "Features" font=bold font-size=lg
    Spacer
    Box "Create feature" link-to=create
  Box
    Box
      Text "Wire frame editor" link-to=detail
      Text "Write wire frame source and see it rendered." font-size=sm
    Box
      Text "Page links" link-to=detail
      Text "Link nodes to other pages in the preview." font-size=sm
    Box
      Text "Features list" link-to=detail
Page "Create feature" id=create
  Box
    Text "Create feature" font=bold font-size=lg
    Text
      Text "Name"
      Box "Feature name"
    Text
      Text "Description (optional)"
      Box "What does this feature do?"
    Row
      Box "Cancel" link-to=features
      Spacer
      Box "Create" link-to=features
Page "Feature detail" id=detail
  Row
    Text "Feature: Wire frame editor" font=bold font-size=lg
    Spacer
    Text "Back to features" link-to=features
  Row
    Text "Wire frame source" width=6
    Text "Wire frame" width=6
  Row
    Box width=6
      Row
        Box "+"
        Box "Log in"
        Box "Forgot password"
      Box
${sourceLineNodes(logInLines)}
${blankLines}
    Box width=6
      Row
        Box "Log in"
        Box "Forgot password"
      Image aspect-ratio=1:2
  Box
    Row
      Text "Data dictionary"
      Spacer
      Box "Add field"
    Row
      Text "Entity" font=bold width=5
      Text "Field" font=bold width=5
      Text "DataType" font=bold width=2
    Row
      Text "Organisation" width=5
      Text "CompanyName" width=5
      Text "string" width=2
    Row
      Text "Organisation" width=5
      Text "AdminEmail" width=5
      Text "string" width=2
    Row
      Text "Organisation" width=5
      Text "AdminFullName" width=5
      Text "string" width=2
`;
