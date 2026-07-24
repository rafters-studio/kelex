import { type PathSegment, pathKey, RECORD_VALUE } from "../introspection/path";
import type { FieldDescriptor, FormDescriptor } from "../introspection/types";
import type { Control } from "./types";

/**
 * Every addressable control in a descriptor, keyed by its canonical path. `*`
 * marks a template slot (array index, record key); recursion stops at its
 * boundary (a `ref` node), since the runtime widget expands it. This is the ONE
 * join both adapters key off. Internal -- never exported from the package root.
 */
export function controlPaths(descriptor: FormDescriptor): Control[] {
  const byKey = new Map<string, Control>();
  for (const field of descriptor.fields) collect(field, [field.name], byKey);
  return [...byKey.values()];
}

function collect(field: FieldDescriptor, path: PathSegment[], byKey: Map<string, Control>): void {
  const m = field.metadata;
  switch (m.kind) {
    case "object":
      for (const c of m.fields) collect(c, [...path, c.name], byKey);
      return;
    case "tuple":
      for (const c of m.elements) collect(c, [...path, c.name], byKey);
      return;
    case "array":
      collect(m.element, [...path, RECORD_VALUE], byKey);
      return;
    case "record":
      collect(m.valueDescriptor, [...path, RECORD_VALUE], byKey);
      return;
    case "union":
      // Variants share the union's position; a field common to variants (the
      // discriminator) dedupes by key. Only one variant exists at runtime, but
      // the static manifest lists every reachable path.
      for (const v of m.variants) for (const c of v.fields) collect(c, [...path, c.name], byKey);
      return;
    case "ref":
      return; // recursion boundary -- the runtime widget reproduces the paths below it
    default: {
      const key = pathKey(path);
      if (!byKey.has(key)) byKey.set(key, { field, key });
    }
  }
}
