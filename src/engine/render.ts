import { type PathSegment, pathKey, RECORD_VALUE } from "../introspection/path";
import type { FieldDescriptor, FieldMetadata, FormDescriptor } from "../introspection/types";
import { matches, resolveConfig } from "./match";
import type { Child, Composer, Renderer, Variant } from "./types";

/**
 * The fold. One recursive rule -- `render(field) = compose(match(field),
 * children.map(render))` -- over the schema's own topology. Each field is
 * matched against the renderer's inventory (first match), its config resolved,
 * and a shape-specific `Input` handed to the matched composer (or `fallback`).
 * The composer's `key` is the canonical path (`*` for template slots), so every
 * control is addressable by the same key the handler later routes to. Generic
 * in `T`; names nothing about markup.
 */
export function render<T>(descriptor: FormDescriptor, renderer: Renderer<T>): T {
  const top = descriptor.fields.map((f) => child(f, [f.name], renderer));
  return renderer.form(top);
}

function child<T>(field: FieldDescriptor, path: PathSegment[], renderer: Renderer<T>): Child<T> {
  return { field, key: pathKey(path), rendered: renderField(field, path, renderer) };
}

function renderField<T>(field: FieldDescriptor, path: PathSegment[], renderer: Renderer<T>): T {
  const entry = matches(field, renderer.inventory);
  const composer: Composer<T> = (entry && renderer.compose[entry.component]) ?? renderer.fallback;
  const base = { field, key: pathKey(path), config: resolveConfig(field, entry?.settings) };
  const m = field.metadata;

  switch (m.kind) {
    case "object":
    case "tuple": {
      const kids = childFields(m).map((c) => child(c, [...path, c.name], renderer));
      return composer({ ...base, shape: "group", children: kids });
    }
    case "array":
      return composer({
        ...base,
        shape: "list",
        item: child(m.element, [...path, RECORD_VALUE], renderer),
      });
    case "record":
      return composer({
        ...base,
        shape: "list",
        item: child(m.valueDescriptor, [...path, RECORD_VALUE], renderer),
      });
    case "union":
      return composer({ ...base, shape: "choice", variants: variantsOf(m, path, renderer) });
    case "ref":
      return composer({ ...base, shape: "recursive" });
    default:
      return composer({ ...base, shape: "control" });
  }
}

function childFields(
  m: Extract<FieldMetadata, { kind: "object" } | { kind: "tuple" }>,
): FieldDescriptor[] {
  return m.kind === "object" ? m.fields : m.elements;
}

function variantsOf<T>(
  m: Extract<FieldMetadata, { kind: "union" }>,
  path: PathSegment[],
  renderer: Renderer<T>,
): Variant<T>[] {
  return m.variants.map((v) => ({
    value: v.value,
    label: typeof v.meta?.["title"] === "string" ? (v.meta["title"] as string) : undefined,
    // The discriminator is the selector, not a rendered field -- drop it here so a
    // variant carries only its own non-discriminator controls.
    children: v.fields
      .filter((c) => c.name !== m.discriminator)
      .map((c) => child(c, [...path, c.name], renderer)),
  }));
}
