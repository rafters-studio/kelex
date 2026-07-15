---
"@rafters/kelex": minor
---

Package renamed from @rafters-studio/kelex to @rafters/kelex. Toolchain modernized: TypeScript 7 (native compiler), tsdown replaces tsup, vitest 4, oxlint + oxfmt replace Biome, pnpm 11 with an allowBuilds approval in pnpm-workspace.yaml so fresh installs work non-interactively. CI now builds before testing and runs the full suite including integration specs; the release workflow gates publishing on tests.
