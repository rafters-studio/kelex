---
"@rafters/kelex": patch
---

Refine warnings now carry the author's message and say plainly what cannot be known.

A `.refine()` the descriptor cannot represent previously reported only that a refinement existed. It now includes the message the author wrote — `"end must be after start"` — which is the only human-readable description of a rule the consumer has to reimplement by hand.

Zod normalizes `{ message }` into an error function rather than storing the string, so recovering it means calling user code. A supplied `error` callback may format from the failing value, where calling it would invent a message for an input that never existed — so the formatter is called twice with different synthetic issues and the result is used only when both agree. A constant message is identical both times; a value-dependent one is not; one that reaches into a real input shape throws and is discarded. Nothing is fabricated.

A refinement with an explicit `path` now renders that path in full rather than just its first segment. One without is reported as **form-level** and states that the fields it constrains are not recoverable, instead of the previous `Field "(form)"` — which read like a field genuinely named that. Zod keeps only the opaque predicate, so the honest answer is that the information does not exist.

Warning count is unchanged.
