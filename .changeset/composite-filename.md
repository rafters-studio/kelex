---
"@rafters/kelex": patch
---

Sanitize the composite target's derived filename. The base name came straight from `form.name` (strip `Form`, kebab-case), so `form.name === "Form"` produced `.composite.json` -- a hidden dotfile -- and a name containing `/` or `\` put path separators in the filename. The CLI has a path-traversal guard, but a library consumer writing `files[]` directly does not. The composite target now replaces path separators with dashes, strips leading dots, and falls back to `form` when the derived name is empty. Normal PascalCase names are unchanged.
