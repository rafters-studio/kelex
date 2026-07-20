---
"@rafters/kelex": patch
---

Warn on `.refine()` at every intersection level. A refinement attached to an intersection nested inside another intersection was dropped silently — `flattenIntersection` scanned its object branch but not its intersection branch, so it recursed past intermediate nodes and discarded their checks.

Root-refinement warnings now come from a single owner (`resolveRootSchema`) rather than two call sites, so a root-level refinement is reported exactly once. Warning count is unchanged for every shape that already warned; only coverage widened.
