# Ideas for Trellis

A list of future ideas for Trellis.

## Tabs for source editor
And ability to sync with wireframe tabs - maybe single set of tabs across both?

## Capture keys
- Tab - add 2 spaces

## omit and only properties on Each element
E.g.
```
List $items omit=id,createdAt
  Each item=item list=$items omit=$omit
    Text $item
```
Could wrap table in this e.g.
```
Def DataTable $entity $only="" $omit="" $link=""
  Table link-to=$link
    Each $entity as=col only=$only omit=$omit
      TableColumn $col
```

## Clean central syntax reference

## Syntax highlighting in editor
- [x] Basic syntax highlighting
- [ ] Code squigglies on errors
- [ ] Auto complete

## Add tool tips
Could be used to explain most things.

## Don't remove rednered wire on syntax error
Only render and update when it compiles successfully.

## Row numbers in source editor

## hr element

## Icons
E.g. allow using name of phosphor.

## Grid / Table component
```
Grid widths=3,6,3
  GridRow "ID" "Name" "Email"
  GridRow "1" "John Doe" "john.doe@example.com"
  GridRow "2" "Jane Smith" "jane.smith@example.com"
```

## Native Component Library
The schema will strictly map to standard UI primitives (e.g., `Container`, `Button`, `DataTable`, `FormInput`) aligned with shadcn UI components.

## Handle overflows more gracefully in Rows
In wireframe viewer.

## Life span of User Stories
Some will be superceeded others will remain valid / implemented - maybe AI can help!

## Decision source
Track whether decisions have been ratified by a human.

## Agent performance
Track agent performance so that we can give it more freedom over time e.g.:
- Every time a decision / assumption that has been made by an agent without a human has to be reversed, score the impact and learn from it.

## UI testing
E.g. playwright.

## When you create a new page preview should jump to it

## Show warning in editor when id of link doesn't exist.

## Add theme provider?
Resolve this comment?
```Typescript
// The app has no theme provider, so (unlike the stock shadcn component) this does not use next-themes.
```

## Add Image component
Like a `Box`, no text, cross.

## UI click to populate element name
Clicking an item in the wireframe inserts it at the current cursor e.g. in the Acceptance Criteria of a User Story e.g. `@@page:login.box-1.email-label` (rough idea).

## Consider how whole system early discovery is supported
E.g. maybe wireframes without features - one big canvase that can can then be carved into features?

## Modals
Maybe Page element has "type=modal" then when it is linked to it renders as a modal over the current page?

## Interrogate wireframe
E.g. QA three amigos view - what does each input do? What are the edge cases?

## DONE

## Iteration macro parameters
E.g.
```
Def Tabs $labels
  Row
    Each item=label list=$labels
      Text $label

# usage
Tabs labels="Home,About,Contact"
```

## Object macro parameters
E.g.
```
Def Card $item=title|description|id
  Box
    Text $item.title
    Text $item.description
    Text $item.id
```

## Width property for elements
Based on 12 column grid.