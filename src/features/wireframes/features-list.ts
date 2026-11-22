/**
 * The wire frame source that the sketched `Feature detail` page shows in its "Wire frame source"
 * pane, one entry per line. It describes the two pages (Log in and Forgot password, linked to each
 * other) whose tabs and Log in form are drawn in that page's "Wire frame" pane.
 * Quotes are curly because the syntax has no way to escape a straight quote inside a text.
 */
const shownSourceLines = [
  "Page “Log in” id=login",
  "  Box",
  "    Text “Log in”",
  "    Box",
  "      Text “Email”",
  "      Box “you@example.com”",
  "    Box",
  "      Text “Password”",
  "      Box “*********”",
  "    Text “Forgot password?” link-to=forgot",
  "    Row",
  "      Box “Cancel”",
  "      Spacer",
  "      Box “Submit”",
  "Page “Forgot password” id=forgot",
  "  Box",
  "    Text “Forgot password”",
  "    Box",
  "      Text “Enter your email”",
  "      Box “you@example.com”",
  "    Box “Send reset link”",
  "    Text “Back to log in” link-to=login",
];

/**
 * Turns the shown source lines into `Text` nodes (as children of a node at 6 spaces). Leading
 * spaces become non-breaking spaces so the preview keeps the indentation.
 */
const shownSourceNodes = shownSourceLines
  .map((line) => `        Text "${line.replace(/^ +/, (spaces) => "\u00a0".repeat(spaces.length))}"`)
  .join("\n");

/**
 * Wire frame source of the `Features list` feature: the Features page (a list of features with a
 * create button), the Create feature dialog and the Feature detail page, linked to each other.
 */
export const featuresListSource = `Page "Features" id=features
  Row
    Text "Features"
    Spacer
    Box "Create feature" link-to=create
  Box
    Row
      Text "Wire frame editor" link-to=detail
      Text "Write wire frame source and see it rendered."
    Row
      Text "Page links" link-to=detail
      Text "Link nodes to other pages in the preview."
    Row
      Text "Features list" link-to=detail
Page "Create feature" id=create
  Box
    Text "Create feature"
    Box
      Text "Name"
      Box "Feature name"
    Box
      Text "Description (optional)"
      Box "What does this feature do?"
    Row
      Spacer
      Box "Cancel" link-to=features
      Box "Create" link-to=features
Page "Feature detail" id=detail
  Text "Back to features" link-to=features
  Text "Feature: Wire frame editor"
  Text "Write wire frame source and see it rendered."
  Text "Wireframe"
  Row
    Box
      Text "Wire frame source"
      Box
${shownSourceNodes}
    Box
      Text "Wire frame"
      Row
        Box "Log in"
        Box "Forgot password"
      Box
        Text "Log in"
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
