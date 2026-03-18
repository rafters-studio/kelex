import {
  generateFormFile,
  generatePrimitivesFile,
} from "../../codegen/templates";
import type { FormDescriptor } from "../../introspection/types";
import { resolveField } from "../../mapping/resolver";
import type { ComponentConfig } from "../../mapping/types";
import type { CodegenTarget, TargetOutputFile, TargetResult } from "../types";
import type { ReactTanStackOptions } from "./types";

export type { ReactTanStackOptions };

export const reactTanStackTarget: CodegenTarget<ReactTanStackOptions> = {
  name: "react-tanstack",
  description: "React + TanStack Form + Tailwind/shadcn components",
  defaultExtension: ".tsx",

  generate(form: FormDescriptor, options: ReactTanStackOptions): TargetResult {
    const useBuiltinPrimitives = options.uiImportPath === undefined;
    const uiImportPath = options.uiImportPath ?? "./primitives";

    const fieldConfigs = new Map<string, ComponentConfig>();
    const processedFields: string[] = [];
    const warnings: string[] = [];

    for (const field of form.fields) {
      try {
        const config = resolveField(field);
        fieldConfigs.set(field.name, config);
        processedFields.push(field.name);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown error";
        warnings.push(`Field "${field.name}": ${message}`);
      }
    }

    const code = generateFormFile({
      form,
      fieldConfigs,
      uiImportPath,
    });

    const files: TargetOutputFile[] = [
      { filename: `${form.name}.tsx`, content: code },
    ];

    if (useBuiltinPrimitives) {
      files.push({
        filename: "primitives.tsx",
        content: generatePrimitivesFile(),
      });
    }

    return { files, fields: processedFields, warnings };
  },
};
