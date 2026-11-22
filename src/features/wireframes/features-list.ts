/**
 * The source lines that the sketched `Feature detail` page shows in each page pane of its "Wire frame
 * source" pane, as the pane's text area holds them: the page's nodes from column 0 (the `Page` line is
 * not shown, it is built from the title and id fields). The two pages (Log in and Forgot password,
 * linked to each other) have their tabs and Log in form drawn in that page's "Wire frame" pane.
 * Quotes are curly because the syntax has no way to escape a straight quote inside a text.
 */
const logInLines = [
  "Box",
  "  Text “Log in” font=bold font-size=lg",
  "  Box",
  "    Text “Email” font=bold",
  "    Box “you@example.com”",
  "  Box",
  "    Text “Password” font=bold",
  "    Box “*********”",
  "  Text “Forgot password?” link-to=forgot font-size=sm",
  "  Row",
  "    Box “Cancel”",
  "    Spacer",
  "    Box “Submit”",
];

const forgotPasswordLines = [
  "Box",
  "  Text “Forgot password” font=bold font-size=lg",
  "  Box",
  "    Text “Enter your email” font-size=sm",
  "    Box “you@example.com”",
  "  Box “Send reset link”",
  "  Text “Back to log in” link-to=login",
];

/**
 * Turns shown source lines into `Text` nodes (as children of a node at 6 spaces). Leading spaces become
 * non-breaking spaces so the preview keeps the indentation.
 */
const sourceLineNodes = (lines: string[]) =>
  lines
    .map((line) => `        Text "${line.replace(/^ +/, (spaces) => "\u00a0".repeat(spaces.length))}"`)
    .join("\n");

/** A page pane as the editor shows it: a bordered box with the title and id row, then the source lines. */
const pagePane = (title: string, id: string, lines: string[]) => `      Box
        BoxRow
          Text "Page:"
          Box "${title}"
          Text "Id:"
          Box "${id}"
${sourceLineNodes(lines)}`;

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
  Text "Back to features" link-to=features
  Text "Feature: Wire frame editor" font=bold font-size=lg
  Text "Write wire frame source and see it rendered." font-size=sm
  Text "Wireframe"
  Row
    Box width=6
      Text "Wire frame source"
${pagePane("Log in", "login", logInLines)}
${pagePane("Forgot password", "forgot", forgotPasswordLines)}
      Box
        Row
          Spacer
          Box "+ Add Page"
          Spacer
    Box width=6
      Text "Wire frame"
      Row
        Box "Log in"
        Box "Forgot password"
      Box
        Text "Log in" font=bold font-size=lg
        Box
          Text "Email"
          Box "you@example.com"
        Box
          Text "Password"
          Box "*********"
        Text "Forgot password?"
        Row
          Box "Cancel"
          Spacer
          Box "Submit"
`;
