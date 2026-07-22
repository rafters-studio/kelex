# kelex plugin system — spec

Status: design-complete, validated by a throwaway spike (folded real zod schemas
through the data rules; since removed). This is the authoritative spec;
`inventory.md` is the inventory detail.

## 1. Model

kelex stays pure: **zod in → `FormDescriptor` out**. Everything downstream is a
plugin. A form is produced by **two unfused adapters**, run in sequence, that
never talk to each other:

```
zod schema ──introspect──▶ FormDescriptor ──renderer──▶ form ──handler──▶ wired form
                                             (inventory + composers)   (state + validation)
```

- **Renderer** (`descriptor → form`): data-driven by an **inventory**, assembled by
  **composers**. Owns _what a field looks like_.
- **Handler** (`form → wired form`): applied _to_ the rendered form. Wires state and
  submit, and **owns validation** — at runtime, via Standard Schema (`~standard`)
  against the user's **live zod schema**, not the descriptor (so custom `.refine`
  messages are real; one schema, no drift).
- **The path is the only join.** `FormDescriptor` stamps every field with its
  Standard-Schema `PathSegment[]`; the renderer preserves it as field identity
  (`name`/id); the handler routes `~standard` issues back by that same path. The two
  adapters meet at the path and nowhere else.

Plugins depend **only on the descriptor**, never on each other — so N component
plugins + M handlers compose as **N+M**, not N×M. The inventory keys to the
**component API**, not the theme: shadcn and rafters (API-compatible) share one;
Carbon/MUI get their own.

## 2. The fold

kelex **orchestrates**; the plugin **composes**. kelex walks the descriptor tree,
matches each node against the inventory (first-match order), and hands each node its
**already-rendered children** to a composer. It cannot compose itself — to combine two
rendered `T`s it would have to name the shape of `T`, which is the render-tree IR we
deliberately do not have. The composer signature:

```
emit(target: { component, settings }, children: T[]) => T   // children empty for a leaf
```

A leaf is a container with zero children. Same path, one primitive.

## 3. The inventory (data)

A flat, ordered table. **First match wins** — NOT specificity scoring (that is the
proven dead end; it forces manual tie-breaking and the parked `defaultMappingRules`
already showed order is the right resolution).

```
Entry {
  match:      Match                          // predicate over descriptor facts; pins `type` + subset
  component:  string                         // renderer's component name (leaf OR container)
  settings?:  Record<string, Setting>        // props for the component
  claim?:     boolean                        // composite: eats the whole subtree, do not descend
}
Setting = Static | "$fact" | { ref: "$fact", default: Static }   // copy, or copy-with-default
```

**Two tiers of match key:**

1. **Structural (the ~90%)** — `type` + coarse facts (format, length-bucket, has-range,
   object shape via `hasFields`). Inferred. Handles email, textarea, number, checkbox,
   enum, address subtrees.
2. **Semantic specials** — otp, phone, money, color: keyed on an explicit
   `.meta({ ui })` tag, matched exactly. Opt-in, cannot leak onto a schema that did not
   ask (an identical untagged 6-char string stays a plain input). These are "more,"
   never the required floor.

**Settings** copy a fact (`"$length"`) or copy-with-default (`{ ref: "$step", default: 1 }`).
They never _transform_ — a value that needs computing (a locale-derived mask) is composer
code, not inventory data. That is the data/code line.

Full match vocabulary (the _complete_ list) and the _required_ floor are in
`inventory.md`. Required floor = a `type`-only catch-all for **every** `FieldType`
(string, number, boolean, date, enum, literal, object, array, union, tuple, record) —
11 entries — so no field ever falls through. kelex validates this at plugin load.

## 4. The composers (code)

A **dispatch map keyed by component**, with a **default** (`<Component>{children}</Component>`,
the kit component arranges its own children). Per-component overrides handle the cases the
default cannot: named slots, and the structurally-special containers.

**Required composer floor = `{ field, container }`** — the two topologies (leaf, branch).
A plugin shipping only those two renders any tree. Everything else is optional
specialization.

Composers own, in code: emission syntax, imports, **field-identity stamping**
(`name`/id = path), the output artifact (files/strings — this replaces the old
hardcoded `TargetResult`), named-slot placement, value transforms, and the
**fallback** for an unmatched field.

**Union is the one container that always needs its own composer** (the default is wrong,
proven): the discriminator is the **selector**, not a rendered field, and variants are
**mutually exclusive**. The composer emits one selector (variant values as options) and
each variant's _non-discriminator_ fields as an exclusive case. A non-discriminated
union has no selector key — the composer must synthesize an (unlabeled) chooser and
should warn.

## 5. Load-time validation

kelex validates a plugin's inventory + composer set with a zod schema **at load**, and
rejects an incomplete one loudly — never a silent dropped field at generate time. It
checks the required floors (every `FieldType` mapped; `field` + `container` composers
present) and well-formed entries. **Completeness is enforceable; correctness is not.**

---

## 6. Borders

Where the system stops. Grouped by how hard the border is.

### kelex owns (in scope)

- `zod → FormDescriptor`: lossless facts + `PathSegment[]` paths.
- The fold: walk, match (first-match order), hand children to composers.
- Load-time validation of a plugin against the required floors.
- The path contract (the one thing enforced end to end).

### The plugin owns

- The inventory (data: match → component + settings).
- The composers (code: emit; `field` + `container` required).
- Emission syntax, imports, output artifact, field-identity stamping, named slots,
  value transforms, unmatched-field fallback.
- The handler: state, submit, validation dialect (rhf resolver / ActiveModel /
  Laravel array / raw `~standard`).

### Hard borders — kelex will NOT

- **Choose components with logic in core.** Data-driven inventory only (#155: kelex
  does not own component selection).
- **Render.** It generates artifacts; the runtime/handler renders.
- **Score specificity.** First-match order only.
- **Match on a regex `pattern`.** Regex source is unstable (`a-zA-Z` ≠ `A-Za-z`); use
  a `.meta` tag. (Proven in the spike.)
- **Match on `.brand()`.** Phantom/type-level, not a runtime fact. (Proven.)
- **Match on cross-field / conditional / stateful facts.** Per-node, stateless.
- **Transform values in settings.** Copy or default only; transforms are composer code.
- **Police renderer↔handler compatibility.** The user picks a sane pair. No legality
  matrix (that matrix was the deleted over-engineering).
- **Interpret presentation meta.** Passthrough only — kelex assembles, never decorates.
- **Let plugins depend on each other.** Everything joins on the descriptor (N+M).
- **Traverse recursive / `z.lazy` schemas.** It warns `unsupported-type` and stops; no
  infinite loop. (Proven.)
- **Map non-form data.** Forms from zod, nothing else.

### Enforced — loud failure

- Malformed inventory or composer set → **reject at load** (zod-validated).
- Any `FieldType` unmapped, or `field`/`container` composer missing → **reject at load**.
- A `$ref` to a fact the field's type cannot carry → **error at generate**.

### Warn — not failure

- A field matched by no inventory entry at generate (#189 output check).
- A `.meta` hint that matched no rule — **intent expressed, not honored** (e.g.
  `ui:"otp"` on a number). Proven silently dropped today; must warn.
- Render-coverage < schema-coverage — a validated field with **no rendered slot**
  orphans its error. Warn at build.
- Unsupported constructs from introspect: `refine`/`transform`/`coerce`/`lazy`, and
  intersection key-overlap.
- Fold depth cap hit (recursion guard).

### Documented convention — not enforced

kelex cannot reach into plugin code, so these are guidance, and a plugin that ignores
them owns its own breakage:

- **Path-as-identity**: emit `name`/id = the descriptor path.
- **Error-slot convention**: each field exposes an `invalid` flag + a path-addressed
  error slot the handler fills.
- **One renderer + one handler** per generate.
- Pick a **sensible renderer/handler pair** (rhf wants React markup, etc.).

### Known limits — and how each reduces

Most limits are _missing information_, reducible by one of two levers: kelex **infers**
it (engineering) or the author **declares** it (`.meta`). The rest are handled elsewhere.

- **Non-discriminated unions** — reducible on both axes:
  - no selector → **infer** an implicit discriminator (a shared literal field). Tracked: **#212**.
  - no labels → **declare** via member `.meta({ title })`. Tracked: **#213**.
  - Residual (irreducible): a union of pure scalars (`string | number`) carries nothing to
    label — warn and require the author to add a discriminator or labels.
- **Recursive / `z.lazy`** — reducible by **inference**: mark the cycle with a `ref` node
  (cycle-detected) instead of dropping it, so a consumer renders a recursive widget.
  Tracked: **#214**. This is the only limit that currently _breaks_ rather than degrades.
- **Refinements / cross-field rules** — NOT a rendering gap. The handler runs `~standard`
  on the live schema at runtime, so these validate and surface by path. Only a _static
  pre-hint_ is absent (rare, low value). Handled by validation-rides-with-handler.
- **Transforms** — NOT a gap. The form renders the _input_ side (what the user types); the
  transform runs at parse in the handler. Rendering the post-transform value is not a form
  concern. By design.
- **Intersections** — pre-flattened by introspect; transparent to the inventory (a
  key-overlap warns). Nothing to reduce.
