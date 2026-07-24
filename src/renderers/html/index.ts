import type { Renderer } from "../../engine/types";
import { leafComposers, leafFallback } from "./composers";
import { containerComposers, type HtmlRendererOptions, makeForm } from "./containers";
import { inventory } from "./inventory";

/**
 * Build the default base-HTML renderer. Zero-dependency, classless semantic HTML:
 * the schema's constraints become native validation attributes and `name = path`
 * gives free serialization plus the handler's join. The markup is INERT -- the
 * post handler (#227) owns every click. `options.action` sets the `<form>` POST
 * target (the one thing that varies per form); everything else is static.
 *
 * It imports ONLY the public contract (`Renderer`), so it is a true plugin --
 * swappable, no privileged core access -- shipped in-package for now. The
 * example stylesheet ships alongside at `./form.css`.
 */
export function createHtmlRenderer(options: HtmlRendererOptions = {}): Renderer<string> {
  return {
    inventory,
    compose: { ...leafComposers, ...containerComposers },
    form: makeForm(options),
    fallback: leafFallback,
  };
}

/** The default renderer instance (no form action -> posts to the same URL). */
export const htmlRenderer: Renderer<string> = createHtmlRenderer();

export type { HtmlRendererOptions } from "./containers";
export { pathToId } from "./path-id";
