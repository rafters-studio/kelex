---
"@rafters/kelex": minor
---

Add the default async-POST handler (`postHandler` / `createPostHandler`) -- the
handler half of the default pair. `wire` wraps a rendered form in place with a
self-contained runtime script that: gates the client with native HTML5
validation (no zod in the browser), collects values by `name` (= path),
un-flattens them to nested JSON, and `fetch`-POSTs to the form's action; routes
server-returned `~standard` issues to each control's path-addressed error slot
(unbound issues go to a form-level sink, never dropped); and owns the
interactivity the renderer left inert -- union variant show/hide (inactive
panels are disabled, so they neither submit nor block validation) and array
add/remove (cloning the `<template>` row and re-indexing `*` -> 0,1,2, with a
monotonic index and compact-on-collect so removes leave no gap). It imports only
the public contract, has no inventory (uniform over paths), and passes
conformance paired with the default HTML renderer.
