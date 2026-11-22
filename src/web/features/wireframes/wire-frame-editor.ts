/**
 * Wire frame source of the `Wire frame editor` feature: a Log in page (Login Form) and a
 * Forgot password page, linked to each other.
 */
export const wireFrameEditorSource = `Page "Log in" id=login
  Box
    Text "Log in" font=bold font-size=lg
    Box
      Text "Email" font=bold
      Box "you@example.com"
    Box
      Text "Password" font=bold
      Box "*********"
    Text "Forgot password?" link-to=forgot font-size=sm
    BoxRow
      Box "Cancel"
      Box "Submit"
Page "Forgot password" id=forgot
  Box
    Text "Forgot password" font=bold font-size=lg
    Box
      Text "Enter your email" font-size=sm
      Box "you@example.com"
    Box "Send reset link"
    Text "Back to log in" link-to=login
`;
