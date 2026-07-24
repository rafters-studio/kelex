import type { Control } from "./types";

/**
 * A Standard Schema issue: a message and an optional path. `~standard` returns
 * paths as raw `PathSegment[]` -- strings and numbers -- but the spec also
 * permits a `{ key }` wrapper per segment, so both are accepted and normalized.
 */
export interface Issue {
  message: string;
  path?: readonly unknown[];
}

/** An issue bound to the control it lands on. `control` is undefined when nothing matched. */
export interface Binding {
  key: string;
  message: string;
  control?: Control;
}

function normalize(raw: readonly unknown[]): (string | number)[] {
  return raw.map((seg) => {
    const s = seg && typeof seg === "object" && "key" in seg ? (seg as { key: unknown }).key : seg;
    return typeof s === "number" ? s : String(s);
  });
}

/** Whether a control key binds an issue path -- segment-equal, with `*` matching any index/key. */
function binds(controlKey: string, issue: (string | number)[]): boolean {
  const control = controlKey.split(".");
  if (control.length !== issue.length) return false;
  return control.every((seg, i) => seg === "*" || seg === String(issue[i]));
}

/**
 * Routes `~standard` validation issues to the controls a renderer stamped -- the
 * handler's join, executed. Each issue's path (a runtime instance like
 * `tags.2.label`) binds to a control key (a canonical template like
 * `tags.*.label`) by wildcard, so an array-row error finds the right control. An
 * issue matching no control is returned with `control` undefined, never dropped.
 */
export function route(controls: Control[], issues: readonly Issue[]): Binding[] {
  return issues.map((issue) => {
    const segments = normalize(issue.path ?? []);
    return {
      key: segments.join("."),
      message: issue.message,
      control: controls.find((c) => binds(c.key, segments)),
    };
  });
}
