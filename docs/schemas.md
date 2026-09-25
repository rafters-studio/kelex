# Schemas

kelex reads a live Zod 4 schema. It imports your schema module and walks the schema objects, not your source text. This page lists what it reads, what it only partly represents, and how to write or generate schemas it reads well.

The root must be a `z.object()`, or an intersection of objects. Anything else at the top level is an error.

## What it reads

| construct                                                                                                                                                                | treatment                                                                                                                                          |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `string`, `number`, `boolean`, `date`, `enum`, `literal`                                                                                                                 | Scalars. Each becomes one control.                                                                                                                 |
| `object`, `array`, `tuple`, `record`, `union`, `discriminatedUnion`                                                                                                      | Containers, nested to any depth.                                                                                                                   |
| `z.lazy`, or a getter that returns the schema itself                                                                                                                     | Recursion. The repeat becomes a `ref` field pointing at the ancestor, so the descriptor stays finite.                                              |
| `optional`, `nullable`, `default`, `catch`, `readonly`                                                                                                                   | Wrappers. They are peeled, and the inner constraints survive. A `default` value is recorded when it is stable; a `catch` fallback is not recorded. |
| `describe`, `meta`                                                                                                                                                       | `description` and the whole `meta` object are carried as written. `meta.title` becomes the label.                                                  |
| `min`/`max`, `gt`/`gte`, `lt`/`lte`, `minLength`/`maxLength`, `.length()`, `regex`, `startsWith`/`endsWith`, `int`, formats (`email`, `url`, `uuid`, `cuid`, `datetime`) | Carried onto the field's constraints. Exclusive and inclusive bounds stay distinct.                                                                |
| intersection                                                                                                                                                             | Flattened into one object. If both sides declare a key, the right-hand one wins.                                                                   |

Field order is preserved.

## What it only partly represents

Each of these is read, and a [warning](./warnings.md) says what was left out.

| construct                                                                                         | what kelex records                                                                                                                 | what it does not                                                                 |
| ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `.refine()`, `.superRefine()`, `.check()`                                                         | That a custom check exists; for a check on the root schema or an intersection member, its message too when it is a literal string. | What the check tests. kelex does not run or reason about it.                     |
| `.transform()`, `.pipe()`                                                                         | The input side: what the form collects.                                                                                            | The output type and any output-side checks.                                      |
| `z.coerce.*`                                                                                      | The target type.                                                                                                                   | The coercion. The form collects raw input.                                       |
| `strictObject`, `catchall`, `passthrough`                                                         | The object and its fields.                                                                                                         | The unknown-key policy.                                                          |
| `z.record` with a non-string key                                                                  | The value schema.                                                                                                                  | The key schema.                                                                  |
| numeric `enum`                                                                                    | The values.                                                                                                                        | That it was an enum; the schema-writer emits a union of literals.                |
| `bigint`, `int64`, `uint64`, `set`, `map`, `file`, `custom`, and other types with no form control | The field, as a plain string.                                                                                                      | The type, and every check or implied range on it, each named in its own warning. |

In every case the rule still lives in your schema. Validate submissions with that schema on the server, and the form and the server agree.

## Labels: authored or derived

A field's `label` is its `meta.title` when you set one, and otherwise a label derived from the key (`displayName` becomes `Display Name`). The two look the same on the field, so check which you have:

```typescript
const authored = typeof field.meta?.title === "string";
```

An authored label is a decision someone made; keep it. A derived label is a guess from the key; a renderer or editor can replace it freely.

## Generating schemas for kelex

Code that emits Zod for kelex, such as a Rust type exporter, gets the best forms by emitting these shapes:

- **Structs** become `z.object()`. Field order is kept, so emit fields in declaration order.
- **Optional fields** (`Option<T>`) become `.optional()`. Use `.nullable()` only when `null` is a meaningful value on the wire.
- **Enums without data** become `z.enum([...])` of strings. Number-valued enums work, with a warning.
- **Enums with data** become `z.discriminatedUnion("type", [...])` with a literal tag in each variant, which matches serde's `#[serde(tag = "type")]`. An untagged `z.union` still renders, but its variants have no names (`variant_0`, `variant_1`) and the choice between them submits nothing.
- **Integers** that fit in 2^53 become `z.int()` or `z.number().int()`, which render as number inputs. `u64` and `i64` become `z.bigint()`, `z.int64()` or `z.uint64()`; those are carried as strings, with a warning naming each bound or range the form does not enforce.
- **Recursive types** (`Box<Self>`, `Vec<Self>`) can use a getter or `z.lazy`. Both produce the same descriptor.
- **Labels** come from `.meta({ title: "..." })`. Without one, kelex derives a label from the field name.
