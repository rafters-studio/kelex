/**
 * The canonical path convention, shared by introspection and the plugin engine.
 *
 * A path follows Standard Schema's `PathSegment[]` convention: string segments
 * are object keys, numbers are array/tuple indices. The single position with no
 * runtime equivalent is a record's value / an array element TEMPLATE, whose real
 * key or index is not known until runtime -- it uses the `RECORD_VALUE` (`"*"`)
 * segment. This module is internal; it is never exported from the package root.
 */

/** A location within a schema: string = object key, number = array/tuple index. */
export type PathSegment = string | number;

/** Stands in for "any key/index" at a record value or array element template slot. */
export const RECORD_VALUE = "*";

/**
 * Renders a path for humans: `bag[0].quality`, `coords[0]`, `stats.*`. A
 * top-level field renders as its bare name, so the common case reads the same
 * as it did before paths existed.
 */
export function formatPath(path: PathSegment[]): string {
  if (path.length === 0) {
    return "(form)";
  }
  return path.reduce<string>((acc, segment, index) => {
    if (typeof segment === "number") {
      return `${acc}[${segment}]`;
    }
    return index === 0 ? String(segment) : `${acc}.${segment}`;
  }, "");
}

/**
 * Joins a path into its canonical dotted key -- the control's `name`. Array and
 * record template slots stay `*` (`tags.*.label`); the handler concretizes `*`
 * to a real index at row-clone time. Distinct from `formatPath` (human display,
 * `[n]` for indices); this is the machine key used for the control name.
 */
export function pathKey(path: PathSegment[]): string {
  return path.map(String).join(".");
}
