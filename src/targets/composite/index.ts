import type { FormDescriptor } from "../../introspection/types";
import type { CodegenTarget, TargetResult } from "../types";
import type { CompositeOptions } from "./types";

export type { CompositeOptions };

/** Fallback base name when a form name sanitizes to nothing (#191). */
const DEFAULT_BASE_NAME = "form";

/**
 * Derives a filesystem-safe base name from the form name: strips the `Form`
 * suffix, kebab-cases, then removes the hazards a library consumer -- which,
 * unlike the CLI, has no path-traversal guard -- could otherwise be handed from
 * an attacker- or user-controlled name (#191). Path separators become dashes so
 * the artifact cannot escape its directory, leading dots are dropped so it is
 * never a hidden dotfile, and an empty result falls back to `DEFAULT_BASE_NAME`.
 * A normal PascalCase name (e.g. `UserProfileForm`) is unaffected.
 */
function toBaseName(formName: string): string {
  const safe = formName
    .replace(/Form$/, "")
    .replace(/([a-z])([A-Z])/g, "$1-$2")
    .toLowerCase()
    .replace(/[/\\]+/g, "-")
    .replace(/^\.+/, "");
  return safe.length > 0 ? safe : DEFAULT_BASE_NAME;
}

export const compositeTarget: CodegenTarget<CompositeOptions> = {
  name: "composite",
  description: "JSON serialization of FormDescriptor",
  defaultExtension: ".composite.json",

  generate(form: FormDescriptor, options: CompositeOptions): TargetResult {
    const indent = options.indent ?? 2;
    // JSON has no bigint, and a raw bigint anywhere in the descriptor (a literal
    // value or a captured default) makes JSON.stringify throw (#176). Render it
    // as its decimal string so the artifact is emitted rather than crashing; a
    // consumer reading a bigint field sees a string, a documented JSON limit.
    const content = JSON.stringify(
      form,
      (_key, value) => (typeof value === "bigint" ? value.toString() : value),
      indent,
    );

    const baseName = toBaseName(form.name);

    return {
      files: [
        {
          filename: `${baseName}.composite.json`,
          content: `${content}\n`,
        },
      ],
      fields: form.fields.map((f) => f.name),
      warnings: [],
    };
  },
};
