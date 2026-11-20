import type { Ast } from "@/schema/ast";

/** Default wireframe shown on load: a simple Login Form. */
export const sampleAst: Ast = {
  id: "login-form",
  type: "Box",
  text: "",
  children: [
    { id: "title", type: "Text", text: "Log in", children: [] },
    {
      id: "email-field",
      type: "Box",
      text: "",
      children: [
        { id: "email-label", type: "Text", text: "Email", children: [] },
        { id: "email-input", type: "Box", text: "you@example.com", children: [] },
      ],
    },
    {
      id: "password-field",
      type: "Box",
      text: "",
      children: [
        { id: "password-label", type: "Text", text: "Password", children: [] },
        { id: "password-input", type: "Box", text: "********", children: [] },
      ],
    },
    { id: "submit-button", type: "Box", text: "Submit", children: [] },
  ],
};
