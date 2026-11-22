/**
 * Wire frame source of the `Wire frame editor` feature: a Log in page (Login Form) and a
 * Forgot password page, linked to each other.
 */
export const wireFrameEditorSource = `Page "Log in" id=login
  Box
    Text "Log in"
    Box
      Text "Email"
      Box "you@example.com"
    Box
      Text "Password"
      Box "*********"
    Text "Forgot password?" link-to=forgot
    BoxRow
      Box "Cancel"
      Box "Submit"
Page "Forgot password" id=forgot
  Box
    Text "Forgot password"
    Box
      Text "Enter your email"
      Box "you@example.com"
    Box "Send reset link"
    Text "Back to log in" link-to=login
`;
