# Topic Info Popup Design

## Background

The `TopicData` type returned by the web-ui API now includes a `workingDirectoryPath`
field ([docs](https://github.com/mumez/pharo-agentic-browser/blob/develop/docs/web-ui-api.md#topicdata)).
There is currently no place in the UI to see it. The sidebar topic list is too
narrow to show it inline, and it doesn't need to be visible at all times — an
on-demand popup in the chat pane header is a better fit.

## Goal

Add an `(i)` info icon next to the topic title in the `ChatConsole` header.
Clicking it opens a modal listing key topic details, including the new
working directory path. The item list should be easy to extend later (e.g.
a future "target package list" field).

## UI

- **Trigger**: small `(i)` icon button placed immediately to the right of the
  topic title (`ChatConsole.tsx`, header `h2` around line 158). Opens the
  modal on click.
- **Modal**: reuse the existing daisyUI modal pattern already used for the
  Settings and Agent Select modals in `Sidebar.tsx`
  (`modal modal-open` wrapper, `modal-box max-w-sm rounded-2xl bg-base-100
  shadow-2xl` box, closes on backdrop click or a close button).
- **Content**: a generic label/value list, rendered with `<For>` over an
  array of `{ label: string; value: string }`, so future fields can be added
  by extending the array — no new markup needed per field.

## Fields shown (in order)

1. Topic ID — full value (not truncated), `font-mono`
2. Title
3. Agent — resolved display name from `agentArguments`, using the same
   lookup as `Sidebar.tsx`'s `agentDisplayName` helper
   (`state.agents.find(a => a.command.join(" ") === agentArguments.join(" "))?.name`,
   falling back to the raw joined arguments or "no arguments")
4. Last Updated
5. Working Directory Path (new)

No copy-to-clipboard affordance — out of scope for this change.

## Data model change

Add `workingDirectoryPath: string` to the `TopicData` interface in
`src/types.ts`. The field already arrives in API responses (topic list,
`topicAdded` event, etc.), so no changes are needed in `client.ts` — it's a
type-level addition only, and the value will flow through automatically via
`selectedTopic()`.

## Code organization

- Extract `agentDisplayName` out of `Sidebar.tsx` into a shared helper (e.g.
  a new `src/utils.ts`, or alongside other store helpers in `store.tsx`) so
  both `Sidebar.tsx` and the new modal in `ChatConsole.tsx` use the same
  logic without duplication.
- Add a small reusable label/value list renderer (can be an inline `<For>`
  in the new modal component; no need for a separate file given its size).

## Out of scope

- Copy-to-clipboard button.
- Editing any of the displayed fields from the modal (read-only).
- Showing the info icon/modal anywhere other than the `ChatConsole` header.
