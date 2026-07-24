import type { Handler } from "../../engine/types";
import { RUNTIME } from "./runtime";

/**
 * The default async-POST handler -- the simplest real, framework-free wiring. It
 * imports ONLY the public contract (`Handler`) and has NO inventory: it is
 * uniform over paths, blind to components, reading only the DOM hooks the
 * renderer stamped. `wire` wraps the rendered form in place (`T -> T`) by
 * appending the self-contained runtime script; it needs neither the controls nor
 * the descriptor, because every path it acts on is already in the markup.
 *
 * Runtime contract (per the epic): a browser + a POST endpoint (the form
 * `action`). CLIENT validation is native HTML5 only -- it does NOT ship zod to
 * the browser. FULL `~standard` validation runs on the SERVER at POST; the script
 * routes the returned issues to each control's error slot by path.
 */
export function createPostHandler(): Handler<string> {
  return {
    // Mark the form so the (static) runtime can find and initialize exactly the
    // forms this handler wired, then append the runtime once after it.
    wire: (form) =>
      `${form.replace("<form", '<form data-kelex-post=""')}\n<script>${RUNTIME}</script>`,
  };
}

/** The default handler instance. */
export const postHandler: Handler<string> = createPostHandler();
