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
    const content = JSON.stringify(form, null, indent);

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
