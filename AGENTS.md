# kelex

Zod schema in, form artifacts out: introspect -> map -> target codegen.
Library + CLI. Stateless: write files and exit.

- Zod 4 peer dependency. Introspection walks live schemas (`schema._zod.def`), not source text -- schema modules are imported and evaluated.
- Tests live in `test/` mirroring `src/`, never colocated. `*.test.ts` unit, `*.spec.ts` integration (require `pnpm build` first).
- `pnpm preflight` before commits, `pnpm flightcheck` before PRs.
- oxlint + oxfmt for lint/format, tsdown for builds, TypeScript 7, vitest 4.
- Changesets for versioning. Targets register in `src/targets/registry.ts`.

Identity, operating contract, and project memory come from legion (`legion whoami`, `legion whatami`, `legion recall --repo kelex`), not this file.
