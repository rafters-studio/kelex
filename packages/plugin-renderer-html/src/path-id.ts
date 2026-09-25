/**
 * A control's `name` is its canonical path (`tags.*.label`) -- literal, the join
 * key. But that string is not a valid HTML `id` (dots, `*`), and `id` must be
 * UNIQUE so `<label for>`, `aria-describedby`, and the error slot address exactly
 * one control. `pathToId` is therefore an INJECTIVE encoding: distinct paths map
 * to distinct ids, so two controls can never collide on an id.
 *
 * Every character outside `[A-Za-z0-9]` is escaped, so the output is
 * `[A-Za-z0-9_]` only and is safe inside any attribute without further escaping.
 * The escape is prefix-free -- `_` leads every escape and the next character says
 * which: `__` is a literal `_`, `_d`/`_x`/`_h` are `.`/`*`/`-`, and `_u<hex>_` is
 * any other code point. `first.name`, `first-name`, and `first_name` all encode
 * differently. The empty path, which a `""` key produces, becomes `_e`, an escape
 * nothing else yields, so no id is ever empty.
 */
const ESCAPE: Record<string, string> = {
  _: "__",
  ".": "_d",
  "*": "_x",
  "-": "_h",
};

export function pathToId(path: string): string {
  if (path === "") return "_e";
  return path.replace(
    /[^A-Za-z0-9]/gu,
    (ch) => ESCAPE[ch] ?? `_u${(ch.codePointAt(0) ?? 0).toString(16)}_`,
  );
}
