---
"@rafters/kelex": patch
---

Remove the `node:crypto` dependency from the programmatic API. `computeVersion` ran on every `introspect()` call and imported `createHash` from `node:crypto`, so importing kelex as a library in a browser, a worker, Deno, or an edge runtime failed at module load. Core is now runtime-agnostic; `node:` imports remain only in the CLI, where they belong.

Replaced with a dependency-free synchronous SHA-256. Web Crypto was not an option: `crypto.subtle.digest` is async, which would have forced `computeVersion` and therefore `introspect()` to become async — a breaking change to the package's central API for the sake of an implementation detail.

**No descriptor versions change.** The implementation produces byte-identical digests to `node:crypto`, asserted against it directly across the SHA-256 padding boundaries, multi-block inputs and non-ASCII encoding, and confirmed by comparing the canonical fixture's version before and after the swap. Consumers pinned against a `FormDescriptor.version` see no movement.
