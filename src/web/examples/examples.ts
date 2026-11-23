import { z } from "zod";
import type { DataDictionaryRow } from "@/data-dictionary/schema";

/**
 * The annotated examples of the Examples page: one small source per element or feature of the syntax, in the order
 * of `CI-023 Coverage (planned)` in /capabilities/examples/capability.md. Add one here when the syntax gains something.
 */

export const ExampleSchema = z.strictObject({
  title: z.string().min(1),
  source: z.string(),
});
export type Example = z.infer<typeof ExampleSchema>;

/** The fields the pointers of the examples name; shown on the Examples page so a reader sees what they point at. */
export const exampleDataDictionary: DataDictionaryRow[] = [
  { entity: "User", field: "FirstName", dataType: "string", label: "First name", mockValues: "Ann;Bob;Cara;Dev;Eve;Finn" },
  { entity: "User", field: "LastName", dataType: "string", label: "Last name", mockValues: "Lee;Ray;Stone;Patel;Kim;Moore" },
  {
    entity: "User",
    field: "Email",
    dataType: "string",
    label: "Email",
    mockValues: "ann@mail.io;bob@mail.io;cara@mail.io;dev@mail.io;eve@mail.io;finn@mail.io",
  },
  { entity: "User", field: "Role", dataType: "string", label: "Role", mockValues: "Admin;Editor;Viewer" },
  { entity: "User", field: "Status", dataType: "string", label: "Status", mockValues: "Active;Invited;Suspended" },
  { entity: "User", field: "Active", dataType: "bool", label: "Is active", mockValues: "true;false" },
];

export const examples: Example[] = z.array(ExampleSchema).parse([
  {
    title: "Page",
    source: `# Every wire frame is made of pages, and every line with no indentation must be a Page.
# The title in quotes is required and becomes the tab label.
Page "Home"
# Everything on a page is indented by 2 spaces per level.
  Text "This is the Home page."
# A source can hold several pages, one after another. Each one gets its own tab.
Page "About"
  Text "This is the About page."
`,
  },
  {
    title: "Box",
    source: `# A Box is a container with a border. Its text is optional.
Page "Box"
  Box "A box with text"
  Box
# A Box can hold other nodes, indented one level under it.
    Text "A box without text, holding a Text"
`,
  },
  {
    title: "Text",
    source: `# A Text is a Box without a border. It is the usual way to write a label or a paragraph.
Page "Text"
  Text "Plain text, no border"
  Box "A Box, for comparison"
`,
  },
  {
    title: "Row",
    source: `# A Row lays its children out left to right on a single line, and has no border.
# Its children never wrap onto a new line.
Page "Row"
  Row
    Box "One"
    Box "Two"
    Box "Three"
`,
  },
  {
    title: "BoxRow",
    source: `# A BoxRow is a Row with a border, the way a Box is a Text with a border.
Page "BoxRow"
  BoxRow
    Text "One"
    Text "Two"
    Text "Three"
`,
  },
  {
    title: "Spacer",
    source: `# A Spacer is invisible and fills the free space of its Row or BoxRow.
# It is only valid as a direct child of one of them.
Page "Spacer"
  Row
    Text "Left"
    Spacer
    Text "Right"
# A Spacer before an element pushes that element, and everything after it, to the right.
  Row
    Spacer
    Box "Done"
`,
  },
  {
    title: "Image",
    source: `# An Image is a placeholder for a picture: a box with an X through it. It has no text and no children.
Page "Image"
  Image
`,
  },
  {
    title: "Table and TableColumn",
    source: `# A Table is made of TableColumns, at least one and nothing else.
# The preview always shows a header row and 10 data rows.
Page "Users" id=users
  Table
# A pointer column takes its header (the label) and its cells (the mock values) from the data dictionary.
# The mock values are written separated by ; there, and they fill the rows one after another.
    TableColumn @User.FirstName width=3
    TableColumn @User.LastName width=3
# A literal column is a quoted header, then | and the quoted, comma separated cell values.
# Values repeat from the start until there are 10 rows, so these 3 are shown 3 times and a bit.
    TableColumn "Plan"|"Free","Pro","Team" width=3
# link-to makes the cells of a column links. The header is never a link.
    TableColumn "Edit"|"Edit user" width=3 link-to=edit-user
Page "Edit user" id=edit-user
  Text "Back to the users" link-to=users
`,
  },
  {
    title: "Page id and link-to",
    source: `# A Page can have an id, so that other nodes can link to it with link-to.
# Click a link in the preview to open the page it names.
Page "Home" id=home
# link-to is allowed on Box, Text, Image and TableColumn.
  Text "Go to the About page" link-to=about
Page "About" id=about
  Box "Back to Home" link-to=home
`,
  },
  {
    title: "width",
    source: `# width sets the share of a Row (or BoxRow) a node takes, in twelfths: width=3 is a quarter.
Page "Width"
  Row
    Box "3 of 12" width=3
    Box "9 of 12" width=9
# Once one child has a width, the children without one count as 3.
  Row
    Box "6 of 12" width=6
    Box "3 (the default)"
`,
  },
  {
    title: "font",
    source: `# font=bold draws the text of the node it is written on in bold. It is not inherited by children.
Page "Font"
  Text "Normal text"
  Text "Bold text" font=bold
  Box "A bold box" font=bold
    Text "Its child stays normal"
`,
  },
  {
    title: "font-size",
    source: `# font-size is sm, md or lg. md is the default.
Page "Font size"
  Text "Small" font-size=sm
  Text "Medium" font-size=md
  Text "Large" font-size=lg
# font and font-size combine, in any order.
  Text "A heading" font=bold font-size=lg
`,
  },
  {
    title: "aspect-ratio",
    source: `# aspect-ratio sets the shape of an Image as W:H. The default is 1:1, a square.
Page "Aspect ratio"
  Row
    Image aspect-ratio=1:1 width=3
    Image aspect-ratio=16:9 width=5
    Image aspect-ratio=3:4 width=3
`,
  },
  {
    title: "Nesting",
    source: `# Nesting is written with indentation only: exactly 2 spaces per level.
Page "Nesting"
  Box "Level 1"
    Box "Level 2"
      Box "Level 3"
        Text "Level 4"
`,
  },
  {
    title: "Macro: Def with parameters",
    source: `# A Def defines a macro once, at the start of a line. Its body is indented by 2 spaces.
# Each $parameter is replaced by the argument given when the macro is used.
Def Field $label $value
  BoxRow
    Text "$label" font=bold
    Box "$value"

Page "Macro"
# A macro is used like a node, with one name=value argument for each parameter.
  Field label="First name" value="Ann"
  Field label="Email" value="ann@example.com"
`,
  },
  {
    title: "Macro: unlabeled argument $1",
    source: `# A macro whose body mentions $1 takes one unlabeled argument, written right after its name.
Def PageTitle
  Text "$1" font=bold font-size=lg

Page "Unlabeled argument"
  PageTitle "My Page"
  Text "The title above is the argument of PageTitle."
`,
  },
  {
    title: "Macro: object parameter",
    source: `# An object parameter groups several fields: $item=title|description is used as $item.title.
Def Card $item=title|description
  Box
    Text "$item.title" font=bold
    Text "$item.description"

Page "Object parameter"
# The fields can be given one by one...
  Card item.title="Welcome" item.description="Say hello to the team"
# ...or together, separated by |, in the order they are declared.
  Card item="Reports"|"See how the team is doing"
`,
  },
  {
    title: "Macro: list parameter with Each",
    source: `# An argument can be a list of values separated by commas.
# Each repeats the lines under it once for every value of the list.
Def List $items
  Box
    Each $items as=item
      Text "$item"

Page "List parameter"
  List items="Reports","Settings","Help"
`,
  },
  {
    title: "Data reference: pointer on a node",
    source: `# A pointer @Entity.Field shows the mock value of a data dictionary field instead of retyping it.
Page "Pointer"
# Add .label to show the label of the field instead.
  Text @User.FirstName.label font=bold
  Box @User.FirstName
  Text @User.Email.label font=bold
  Box @User.Email
`,
  },
  {
    title: "Data reference: pointer macro argument",
    source: `# A macro can take a pointer: an object parameter that names data dictionary columns
# receives the label and the mock values of the field.
Def Field $for=label|mockValues
  Text "$for.label" font=bold
  Box "$for.mockValues"

Page "Pointer argument"
  Field for=@User.FirstName
  Field for=@User.Email
`,
  },
  {
    title: "Data reference: pointer column",
    source: `# A TableColumn can be a pointer: its header is the label and its cells are the mock values.
# Mock values written with ; in the data dictionary, such as Admin;Editor;Viewer, fill the rows one after another.
Page "Pointer column"
  Table
    TableColumn @User.Email width=5
    TableColumn @User.Role width=3
    TableColumn @User.Status width=4
`,
  },
  {
    title: "Comments",
    source: `# A line that starts with # in column 0 is a comment: it is ignored, like a blank line.
# These notes are comments, so they are shown here but never drawn in the wire frame.
Page "Comments"
# A comment can be written anywhere, between nodes or between pages, at any depth.
  Box "A box"
# It does not change the indentation of the lines around it.
    Text "A child of the box"
# Only column 0 counts: a # inside text is just text.
  Text "# This is text, not a comment"
`,
  },
]);
