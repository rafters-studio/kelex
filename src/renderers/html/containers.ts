import type { Child, Composer } from "../../engine/types";
import { attrs, escapeHtml } from "./attrs";
import { pathToId } from "./path-id";

/**
 * The container half of the base-HTML renderer (#228). Every container is INERT
 * structure with data hooks -- the post handler (#227) owns every click. Groups
 * become `<fieldset><legend>`; lists become a repeater (`<template>` row + inert
 * add/remove buttons); unions become a switch (a variant selector + tagged
 * panels); a recursive boundary emits an inert marker (the runtime widget
 * expands it). Together with the leaf inventory this completes the full floor.
 */

const kidsOf = (children: Child<string>[]): string => children.map((c) => c.rendered).join("");

/** object/tuple -> a labelled fieldset wrapping the child controls. */
const group: Composer<string> = (i) => {
  if (i.shape !== "group") return "";
  return `<fieldset${attrs({ "data-path": i.key })}><legend>${escapeHtml(i.field.label)}</legend>${kidsOf(i.children)}</fieldset>`;
};

/**
 * array/record -> a repeater. The item (its paths carry the `*` template slot)
 * lives in a `<template>` the handler clones and re-indexes; a per-row remove
 * button sits inside it, and an add button below. All buttons are `type=button`
 * (inert) with `data-add-row`/`data-remove-row` hooks -- no event wiring here.
 */
const list: Composer<string> = (i) => {
  if (i.shape !== "list") return "";
  const row = `${i.item.rendered}<button${attrs({ type: "button", "data-remove-row": i.key })}>Remove</button>`;
  return (
    `<fieldset${attrs({ "data-path": i.key })}><legend>${escapeHtml(i.field.label)}</legend>` +
    `<template${attrs({ "data-row": i.item.key })}>${row}</template>` +
    `<button${attrs({ type: "button", "data-add-row": i.key })}>Add ${escapeHtml(i.field.label)}</button>` +
    `</fieldset>`
  );
};

/**
 * union -> a switch: a variant `<select data-variant-of>` plus one tagged panel
 * per variant (`data-variant` + `data-when` = the variant's value). For a
 * DISCRIMINATED union the selector also carries `name = <key>.<discriminator>`
 * -- the discriminator is a real control `controlPaths` lists but the fold drops
 * from variant children, so the composer stamps it here. The `<key>.<disc>` join
 * is hand-built for now; #234 will hand the composer a first-class discriminator
 * child so no path is reconstructed by hand.
 */
const choice: Composer<string> = (i) => {
  if (i.shape !== "choice") return "";
  const m = i.field.metadata;
  const disc = m.kind === "union" ? m.discriminator : undefined;
  const selectName = disc ? `${i.key}.${disc}` : undefined;
  const options = i.variants
    .map(
      (v) =>
        `<option${attrs({ value: String(v.value) })}>${escapeHtml(v.label ?? String(v.value))}</option>`,
    )
    .join("");
  const selector = `<select${attrs({
    "data-variant-of": i.key,
    name: selectName,
    id: selectName ? pathToId(selectName) : undefined,
  })}>${options}</select>`;
  const panels = i.variants
    .map(
      (v) =>
        `<div${attrs({ "data-variant": true, "data-when": String(v.value) })}>${kidsOf(v.children)}</div>`,
    )
    .join("");
  return `<fieldset${attrs({ "data-path": i.key })}><legend>${escapeHtml(i.field.label)}</legend>${selector}${panels}</fieldset>`;
};

/** ref -> an inert recursion-boundary marker. `controlPaths` stops here, so it
 * stamps no control below; the runtime widget reproduces the paths at expansion. */
const recursive: Composer<string> = (i) =>
  `<fieldset${attrs({ "data-path": i.key, "data-recursive": true })}><legend>${escapeHtml(i.field.label)}</legend><!-- recursive boundary --></fieldset>`;

/** The container composers, keyed by the components the container inventory names. */
export const containerComposers: Record<string, Composer<string>> = {
  group,
  list,
  choice,
  recursive,
};

/** Options for the form wrapper -- where a submit POSTs, and by what method. */
export interface HtmlRendererOptions {
  /** The form `action` (POST target). Omitted -> posts to the same URL. */
  action?: string;
  /** The form method (default `post`). */
  method?: string;
}

/**
 * The real `<form>` wrapper (upgrading #226's minimal stub): the action/method
 * from options plus an inert submit `<button type=submit>`. The handler (#227)
 * intercepts submit; the button is plain markup.
 */
export const makeForm =
  (options: HtmlRendererOptions) =>
  (children: Child<string>[]): string =>
    `<form${attrs({ action: options.action, method: options.method ?? "post" })}>${kidsOf(children)}<button${attrs({ type: "submit" })}>Submit</button></form>`;
