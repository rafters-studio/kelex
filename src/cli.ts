#!/usr/bin/env node

import * as fs from "node:fs";
import * as path from "node:path";
import { pathToFileURL } from "node:url";
import { Command } from "commander";
import { generate } from "./codegen/generator";
import { listTargets, resolveTarget } from "./targets/registry";

interface GenerateCommandOptions {
  output?: string;
  name?: string;
  schema: string;
  ui?: string;
  target: string;
}

const program = new Command();

program
  .name("kelex")
  .description("Generate forms from Zod schemas")
  .version("0.0.1");

program
  .command("generate <schema-path>")
  .description("Generate a form component from a Zod schema")
  .option("-o, --output <path>", "Output file path")
  .option("-n, --name <name>", "Form component name")
  .option("-s, --schema <name>", "Exported schema name", "schema")
  .option(
    "--ui <path>",
    "UI component import path (generates built-in primitives if omitted)",
  )
  .option("-t, --target <name>", "Code generation target", "react-tanstack")
  .action(async (schemaPath: string, options: GenerateCommandOptions) => {
    try {
      await runGenerate(schemaPath, options);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Error: ${message}`);
      process.exit(1);
    }
  });

program
  .command("targets")
  .description("List available code generation targets")
  .action(() => {
    const targets = listTargets();
    console.log("Available targets:\n");
    for (const t of targets) {
      console.log(`  ${t.name}`);
      console.log(`    ${t.description}`);
      console.log(`    Default extension: ${t.defaultExtension}`);
      console.log();
    }
  });

program.parse();

async function runGenerate(
  schemaPath: string,
  options: GenerateCommandOptions,
): Promise<void> {
  const absoluteSchemaPath = path.resolve(schemaPath);

  if (!fs.existsSync(absoluteSchemaPath)) {
    throw new Error(`Schema file not found: ${absoluteSchemaPath}`);
  }

  const target = resolveTarget(options.target);

  const schemaUrl = pathToFileURL(absoluteSchemaPath).href;
  const schemaModule = await import(schemaUrl);

  const schemaExportName = options.schema;
  const schema = schemaModule[schemaExportName] ?? schemaModule.default;

  if (!schema) {
    throw new Error(
      `Schema "${schemaExportName}" not exported from ${schemaPath}`,
    );
  }

  if (!schema._zod) {
    throw new Error(
      `Export "${schemaExportName}" is not a Zod schema. Ensure you are using zod >= 4.0.0`,
    );
  }

  const outputPath =
    options.output ?? deriveOutputPath(schemaPath, target.defaultExtension);
  const absoluteOutputPath = path.resolve(outputPath);
  const formName = options.name ?? deriveFormName(schemaExportName);
  const schemaImportPath = calculateImportPath(
    absoluteOutputPath,
    absoluteSchemaPath,
  );

  const result = generate({
    schema,
    formName,
    schemaImportPath,
    schemaExportName,
    target,
    ...(options.ui ? { uiImportPath: options.ui } : {}),
  });

  const outputDir = path.dirname(absoluteOutputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const resolvedOutputDir = path.resolve(outputDir);
  for (const file of result.files) {
    const filePath = path.resolve(outputDir, file.filename);
    if (
      !filePath.startsWith(`${resolvedOutputDir}${path.sep}`) &&
      filePath !== resolvedOutputDir
    ) {
      throw new Error(
        `Target produced a filename that escapes the output directory: ${file.filename}`,
      );
    }
    fs.writeFileSync(filePath, file.content, "utf-8");
    console.log(`\u2713 Generated ${filePath}`);
  }

  console.log(`  ${result.fields.length} fields: ${result.fields.join(", ")}`);

  if (result.warnings.length > 0) {
    console.log("\nWarnings:");
    for (const warning of result.warnings) {
      console.log(`  \u26A0 ${warning}`);
    }
  }
}

/**
 * Derives output path from schema path.
 * ./user-schema.ts -> ./user-form.tsx
 */
function deriveOutputPath(
  schemaPath: string,
  defaultExtension: string,
): string {
  const dir = path.dirname(schemaPath);
  const base = path.basename(schemaPath, path.extname(schemaPath));
  const formBase = base.replace(/-schema$/i, "").replace(/schema$/i, "");
  const finalBase = formBase || base;
  return path.join(dir, `${finalBase}-form${defaultExtension}`);
}

/**
 * Derives form name from schema export name.
 * userSchema -> UserForm
 */
function deriveFormName(schemaExportName: string): string {
  const base = schemaExportName
    .replace(/Schema$/i, "")
    .replace(/^./, (s) => s.toUpperCase());

  const finalBase = base || "Generated";
  return `${finalBase}Form`;
}

/**
 * Calculates relative import path from output file to schema file.
 */
function calculateImportPath(outputPath: string, schemaPath: string): string {
  const outputDir = path.dirname(outputPath);
  let relativePath = path.relative(outputDir, schemaPath);
  relativePath = relativePath.replace(/\.(ts|tsx)$/, "");

  if (!relativePath.startsWith(".") && !relativePath.startsWith("/")) {
    relativePath = `./${relativePath}`;
  }

  return relativePath;
}
