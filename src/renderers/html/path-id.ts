/**
 * A control's `name` is its canonical path (`tags.*.label`) -- literal, the join
 * key. But that string is not a valid HTML `id` (dots, `*`), and `id` must be
 * UNIQUE so `<label for>`, `aria-describedby`, and the error slot address exactly
 * one control. `pathToId` is therefore an INJECTIVE encoding: distinct paths map
 * to distinct ids, so two controls can never collide on an id.
 *
 * The escape is prefix-free -- `_` leads every escape, so a literal `_` (`__`)
 * can never be confused with an escaped `.`/`*`/`-`. `first.name`, `first-name`,
 * and `first_name` all encode differently. The output is `[A-Za-z0-9_]` only.
 */
const ESCAPE: Record<string, string> = {
  _: "__",
  ".": "_d",
  "*": "_x",
  "-": "_h",
};

export function pathToId(path: string): string {
  return path.replace(/[_.*-]/g, (ch) => ESCAPE[ch] ?? ch);
}
