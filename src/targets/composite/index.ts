import type { FormDescriptor } from "../../introspection/types";
import type { CodegenTarget, TargetResult } from "../types";
import type { CompositeOptions } from "./types";

export type { CompositeOptions };

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

    const baseName = form.name
      .replace(/Form$/, "")
      .replace(/([a-z])([A-Z])/g, "$1-$2")
      .toLowerCase();

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
