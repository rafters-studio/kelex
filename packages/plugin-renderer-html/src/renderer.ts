import type { Renderer } from "kelex/engine";
import { leafComposers, leafFallback } from "./composers";
import { containerComposers, type HtmlRendererOptions, makeForm } from "./containers";
import { loadInventory } from "./load-inventory";

/**
 * Build the base-HTML renderer. Zero-dependency, classless semantic HTML: the
 * schema's constraints become native validation attributes and `name = path`
 * gives the handler's join. The markup is INERT -- the post handler owns every
 * click. `options.action` sets the `<form>` POST target. The inventory (the data
 * half) is loaded from `inventory.jsonl`, so it is editable without touching code.
 */
export function createHtmlRenderer(options: HtmlRendererOptions = {}): Renderer<string> {
  return {
    inventory: loadInventory(),
    compose: { ...leafComposers, ...containerComposers },
    form: makeForm(options),
    fallback: leafFallback,
  };
}

/** The default renderer instance (no form action -> posts to the same URL). */
export const htmlRenderer: Renderer<string> = createHtmlRenderer();

// The plugin load contract: kelex's host imports this package and calls the
// default export as `(options) => Renderer`.
export default createHtmlRenderer;

export type { HtmlRendererOptions } from "./containers";
export { pathToId } from "./path-id";
