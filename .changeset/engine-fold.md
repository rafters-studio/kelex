---
"@rafters/kelex": minor
---

Add `render(descriptor, renderer): T` -- the plugin engine's fold. One recursive rule over the schema's topology: each field is matched to an inventory entry (first match), its config resolved, and a shape-specific `Input` (control/group/list/choice/recursive) handed to the matched composer or the renderer's fallback. Every control's `key` is its canonical path (`*` for template slots), a union folds to a `choice` with the discriminator dropped from variant fields, and a `ref` folds to a `recursive` boundary without recursing. Generic in `T`; names nothing about markup.
