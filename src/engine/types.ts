import type { FieldDescriptor, FieldType, FormDescriptor } from "../introspection/types";

/**
 * The plugin engine's public contract. The vocabulary is form-words: an author
 * writes composers for the FIVE shapes (`control`/`group`/`list`/`choice`/
 * `recursive`) and reads a field's `key`, `label` (off the field), `config`, and
 * `children`. The CS terms (`path`, `matches`, `controlPaths`) stay internal and
 * are never exported from the package root.
 */

/** A config bag handed to a composer -- settings with `$ref`s already resolved. */
export type Config = Record<string, unknown>;

/** A setting value: a literal, a `$ref` to a field fact, or a `$ref` with a default. */
export type Setting = unknown | { ref: `$${string}`; default: unknown };

/** A numeric threshold used in a length/number match bucket. */
export interface Bound {
  gt?: number;
  gte?: number;
  lt?: number;
  lte?: number;
}

/**
 * A predicate over a field's facts. Pins `type`; every other fact is optional.
 * Order in the inventory is precedence -- a more specific entry sits earlier.
 */
export interface Match {
  type: FieldType;
  /** A string's format (`email`/`url`/`uuid`/...). */
  format?: string;
  /** A `.meta({ ui })` hint (`otp`, `password`, ...). */
  ui?: string;
  /** Length buckets (read from `length` or min/maxLength). */
  minLength?: Bound;
  maxLength?: Bound;
  /** True to require a bounded number (both a numeric min and max present). */
  bounded?: boolean;
  /** An object shape: has at least these field names -- a composite subtree. */
  hasFields?: string[];
}

/** One inventory row: which component answers a field, plus its config. */
export interface Entry {
  match: Match;
  component: string;
  settings?: Record<string, Setting>;
}

/** A child folded to `T`, with its field and key. */
export interface Child<T> {
  field: FieldDescriptor;
  key: string;
  rendered: T;
}

/** One variant of a `choice` (union), with its already-rendered fields. */
export interface Variant<T> {
  value: string | number | boolean;
  label?: string;
  children: Child<T>[];
}

/**
 * What the fold hands a composer: the field, its `key` (name = canonical path,
 * `*` for template slots), the resolved `config`, and a shape-specific body.
 * `shape` mirrors the schema's own topology, so there are no special branches.
 */
export type Input<T> = { field: FieldDescriptor; key: string; config: Config } & (
  | { shape: "control" }
  | { shape: "group"; children: Child<T>[] }
  | { shape: "list"; item: Child<T> }
  | { shape: "choice"; variants: Variant<T>[] }
  | { shape: "recursive" }
);

/** A composer: given a shaped field, produce `T`. The renderer's `plugin.ts`. */
export type Composer<T> = (input: Input<T>) => T;

/** A renderer plugin: an inventory (data) + composers (code) + a form wrapper. */
export interface Renderer<T> {
  inventory: Entry[];
  compose: Record<string, Composer<T>>;
  form: (children: Child<T>[]) => T;
  fallback: Composer<T>;
}

/** An addressable control in a rendered form: its field and its key (name). */
export interface Control {
  field: FieldDescriptor;
  key: string;
}

/**
 * A handler plugin: wires a rendered form -- state, validation, submit -- by
 * control key. It has NO inventory (it is uniform over controls, blind to
 * components). A wrap-in-place handler returns the same `T`.
 */
export interface Handler<T> {
  wire(form: T, controls: Control[], descriptor: FormDescriptor): T;
}
