# Official plugins

kelex loads two plugins per run: one renderer that turns the descriptor into output, and one handler that wires that output up. They never talk to each other. They meet on the field's canonical path.

Everything here is optional. Write your own instead and kelex will load it exactly the same way. See [writing a plugin](../writing-plugins.md).

## Renderers

A renderer turns a `FormDescriptor` into output of some type. It carries an inventory that maps a field to a component name, and the composers that build the output.

| renderer                                             | status  | output           | notes                                                            |
| ---------------------------------------------------- | ------- | ---------------- | ---------------------------------------------------------------- |
| [`@rafters/kelex-renderer-html`](./renderer-html.md) | shipped | `string` of HTML | classless, zero dependencies, native validation attributes       |
| rafters                                              | planned | TBD              | rafters composites and components, token vocabulary from rafters |
| shadcn                                               | planned | TBD              | shadcn component API                                             |

rafters meets the shadcn component API, so the two overlap where the APIs match. rafters is the larger system, with composites and an assembly model shadcn has no equivalent for, so its inventory is a superset rather than the same file.

## Handlers

A handler takes rendered output and wires it: state, submit, and routing server errors back to the right control. It has no inventory, because it is uniform over controls and blind to which components the renderer picked.

| handler                                            | status  | wiring                   | notes                                          |
| -------------------------------------------------- | ------- | ------------------------ | ---------------------------------------------- |
| [`@rafters/kelex-handler-post`](./handler-post.md) | shipped | async POST, no framework | native HTML5 validation, self-contained script |
| nanostores                                         | planned | nanostores               | TBD                                            |
| zustand                                            | planned | zustand                  | TBD                                            |
| TanStack Form                                      | planned | TanStack Form            | TBD                                            |
| React Hook Form                                    | planned | React Hook Form          | TBD                                            |

Planned entries are named by the library they wrap. Their package names are not settled yet.

Handlers share nothing but the interface. nanostores, zustand, TanStack Form, and React Hook Form have unrelated wiring APIs, so there is no common layer to extract and none is planned.

## Mixing them

Any renderer works with any handler that speaks the same output type. A renderer producing HTML strings pairs with a handler that wraps HTML strings. A renderer producing a React tree needs a handler that wraps a React tree.

Name the pair in `kelex.settings.jsonc`:

```jsonc
{
  "renderer": "@rafters/kelex-renderer-html",
  "handler": "@rafters/kelex-handler-post",
}
```

`handler` is optional. A project that wants markup and no wiring names only a renderer.
