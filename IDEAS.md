# Ideas for Trellis

A list of future ideas for Trellis.

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