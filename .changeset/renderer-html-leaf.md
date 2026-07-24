---
"@rafters/kelex": minor
---

Add the default base-HTML renderer -- leaf half (`htmlRenderer`). A
zero-dependency, classless renderer whose ordered inventory is the canonical
reference: format (email/url), meta-hint (password/otp/tel), and
constraint-bucket (long string -> textarea, bounded number -> range)
specializations sit above a type-only catch-all for every scalar FieldType.
Every control emits the hook trio (`name` = path, injective `id = pathToId`,
`data-path`), native validation attributes from the schema's constraints, a
`<label for>`, the aria pair, and a path-addressed error slot -- inert markup,
no behavior. Also adds a `types` scope to `conformance`/`validateRenderer` so a
leaf-only renderer proves itself against the scalar shapes. Containers, the real
`<form action>`, buttons, and the stylesheet are the container half (#228).
