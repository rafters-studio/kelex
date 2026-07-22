---
"@rafters/kelex": minor
---

Mark synthetic union variants explicitly. The reader wraps a non-object union member (the `z.number()` in `z.union([z.object({...}), z.number()])`) in a single-field object so every variant has a uniform shape, but nothing marked the wrapper -- so the writer reverse-engineered it from a `"variant_N"` / `"option_N"` name pattern. That heuristic misfired on a real object whose only field is literally named `option_0`, round-tripping `z.union([z.object({ option_0: z.string() }), z.number()])` to `z.union([z.string(), z.number()])` and deleting the object. Union variants now carry a `synthetic?: true` marker; the writer keys off it and consumers can tell a wrapped scalar from a real single-field object.
