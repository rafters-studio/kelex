---
"@rafters-studio/kelex": minor
---

Remove the react-tanstack target and all React/JSX code generation. The composite JSON FormDescriptor target is now the only built-in target and the CLI default. The audited React codegen did not compile against current @tanstack/react-form and is being replaced by a new target design; the pre-cut state is tagged `pre-codegen-cut`. Also removes the unused zocker test infrastructure, fixes the broken `test:spec` script, and makes `kelex --version` report the real package version.
