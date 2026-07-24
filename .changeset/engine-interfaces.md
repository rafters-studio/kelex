---
"@rafters/kelex": minor
---

Add the plugin engine's contract: the `Renderer<T>`/`Handler<T>`/`Composer<T>`/`Input<T>` interfaces over five form-word shapes (`control`/`group`/`list`/`choice`/`recursive`), the `Entry`/`Match`/`Setting`/`Control`/`Child` types, the internal match/config engine (`matches` first-match resolution, `resolveConfig` `$ref` resolution), and the internal `controlPaths` join manifest (`*` for template slots, stopping at a recursion boundary). The `PathSegment`/`RECORD_VALUE`/`formatPath` path helpers are lifted to a shared internal module. The plugin API exports form-word types only; the CS terms (`path`, `matches`, `controlPaths`) stay internal.
