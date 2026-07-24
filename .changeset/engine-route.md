---
"@rafters/kelex": minor
---

Add `route(controls, issues)` -- the join executed. It maps Standard Schema validation issues back to the controls a renderer stamped: each issue's runtime path (`tags.2.label`) binds to a control key (`tags.*.label`) by segment match with `*` as a wildcard for template slots, and `{key}`-wrapped segments are normalized. Standard Schema issue paths come back as raw `PathSegment[]` and match kelex's keys 1:1; an issue matching no control is surfaced with `control` undefined, never dropped. This is the helper every handler uses to route validation errors to error slots by path.
