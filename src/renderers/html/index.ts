import type { Renderer } from "../../engine/types";
import { form, leafComposers, leafFallback } from "./composers";
import { leafInventory } from "./inventory";

/**
 * The default base-HTML renderer -- LEAF half (#226). Zero-dependency, classless
 * semantic HTML: the schema's constraints become native validation attributes and
 * `name = path` gives free serialization plus the handler's join. INERT only --
 * no behavior (that is the post handler, #227). Containers (fieldset/repeater/
 * switch), the real `<form action>`, and the stylesheet are the container half
 * (#228); here `form` is a minimal wrapper and containers fall to `fallback`.
 *
 * It imports ONLY the public contract (`Renderer`), so it is a true plugin --
 * swappable, no privileged core access -- shipped in-package for now.
 */
export const htmlRenderer: Renderer<string> = {
  inventory: leafInventory,
  compose: leafComposers,
  form,
  fallback: leafFallback,
};

export { pathToId } from "./path-id";
