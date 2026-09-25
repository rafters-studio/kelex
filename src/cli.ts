#!/usr/bin/env node

import * as fs from "node:fs";
import { createRequire } from "node:module";
import * as path from "node:path";
import { pathToFileURL } from "node:url";
import { Command } from "commander";
import type { $ZodType } from "zod/v4/core";
import { generate } from "./codegen/generator";
import { generateForm, loadSettings, writeForm } from "./settings";
import type { KelexSettings } from "./settings/types";
import { listTargets, resolveTarget } from "./targets/registry";

interface GenerateCommandOptions {
  output?: string;
  name?: string;
  schema: string;
  target: string;
}

interface FormCommandOptions {
  config: string;
  export: string;
  out?: string;
  renderer?: string;
  handler?: string;
  action?: string;
}

const require = createRequire(import.meta.url);
const { version } = require("../package.json") as { version: string };

const program = new Command();

program.name("kelex").description("Zod schema in, form out — a plugin host").version(version);

program
  .command("form <schema-path>", { isDefault: true })
  .description("Generate a form: kelex.settings.jsonc names the plugins; the schema is a run input")
  .option("-c, --config <path>", "Settings file (plugins to load)", "kelex.settings.jsonc")
  .option("-e, --export <name>", "Exported schema name", "schema")
  .option("-o, --out <path>", "Output path (default derived from the schema path)")
  .option("-r, --renderer <pkg>", "Renderer plugin package (overrides settings)")
  .option("-H, --handler <pkg>", "Handler plugin package (overrides settings)")
  .option("-a, --action <url>", "Form POST action (forwarded to the renderer)")
  .action(async (schemaPath: string, options: FormCommandOptions) => {
    try {
      await runForm(schemaPath, options);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Error: ${message}`);
      process.exit(1);
    }
  });

program
  .command("generate <schema-path>")
  .description("Generate a form component from a Zod schema")
  .option("-o, --output <path>", "Output file path")
  .option("-n, --name <name>", "Form component name")
  .option("-s, --schema <name>", "Exported schema name", "schema")
  .option("-t, --target <name>", "Code generation target", "composite")
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

/**
 * The settings name the plugins; the schema, output, and options are run inputs.
 * Import the schema module, then fold the form with the loaded plugins.
 */
async function runForm(schemaPath: string, options: FormCommandOptions): Promise<void> {
  const settings: KelexSettings = loadSettings(options.config);
  if (options.renderer) settings.renderer = options.renderer;
  if (options.handler) settings.handler = options.handler;

  const schema = await importSchema(schemaPath, options.export);
  const { output, fields } = await generateForm(schema, {
    settings,
    formName: deriveFormName(options.export),
    rendererOptions: options.action ? { action: options.action } : undefined,
    // The CLI loads the settings itself, so it names where they came from.
    from: path.dirname(path.resolve(options.config)),
  });

  const outPath = options.out ?? deriveOutputPath(schemaPath, ".html");
  // The CLI writes a file, so it needs text; a renderer that builds a tree (a
  // React renderer, say) belongs in code that calls generateForm, not here.
  if (typeof output !== "string") {
    throw new Error(
      `renderer "${settings.renderer}" produced ${output === null ? "null" : typeof output}, ` +
        "not text; the CLI can only write a renderer whose output is a string",
    );
  }
  writeForm(outPath, output);
  console.log(`✓ Generated ${path.resolve(outPath)}`);
  console.log(`  renderer: ${settings.renderer} + ${settings.handler ?? "no handler (unwired)"}`);
  console.log(`  ${fields.length} fields: ${fields.join(", ")}`);
}

/**
 * Import a schema module and return the named export (or the default), checked
 * to be a live Zod 4 schema. Both commands read their schema through this.
 */
async function importSchema(schemaPath: string, exportName: string): Promise<$ZodType> {
  const absoluteSchemaPath = path.resolve(schemaPath);
  if (!fs.existsSync(absoluteSchemaPath)) {
    throw new Error(`Schema file not found: ${absoluteSchemaPath}`);
  }
  const schemaModule: Record<string, unknown> = await import(
    pathToFileURL(absoluteSchemaPath).href
  );
  const schema = schemaModule[exportName] ?? schemaModule.default;
  if (schema === undefined) {
    throw new Error(`Schema "${exportName}" not exported from ${schemaPath}`);
  }
  if (typeof schema !== "object" || schema === null || !("_zod" in schema)) {
    throw new Error(
      `Export "${exportName}" is not a Zod schema. Ensure you are using zod >= 4.0.0`,
    );
  }
  return schema as $ZodType;
}

async function runGenerate(schemaPath: string, options: GenerateCommandOptions): Promise<void> {
  const schemaExportName = options.schema;
  const schema = await importSchema(schemaPath, schemaExportName);
  const target = resolveTarget(options.target);
  const absoluteSchemaPath = path.resolve(schemaPath);

  const outputPath = options.output ?? deriveOutputPath(schemaPath, target.defaultExtension);
  const absoluteOutputPath = path.resolve(outputPath);
  const formName = options.name ?? deriveFormName(schemaExportName);
  const schemaImportPath = calculateImportPath(absoluteOutputPath, absoluteSchemaPath);

  const result = generate({
    schema,
    formName,
    schemaImportPath,
    schemaExportName,
    target,
  });

  const outputDir = path.dirname(absoluteOutputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const resolvedOutputDir = path.resolve(outputDir);
  for (let i = 0; i < result.files.length; i++) {
    const file = result.files[i];
    const filePath = i === 0 ? absoluteOutputPath : path.resolve(outputDir, file.filename);
    if (!filePath.startsWith(`${resolvedOutputDir}${path.sep}`) && filePath !== resolvedOutputDir) {
      throw new Error(
        `Target produced a filename that escapes the output directory: ${file.filename}`,
      );
    }
    try {
      fs.writeFileSync(filePath, file.content, "utf-8");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to write ${filePath}: ${message}`);
    }
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
 * e.g. ./user-schema.ts -> ./user-form{defaultExtension}
 */
function deriveOutputPath(schemaPath: string, defaultExtension: string): string {
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
  const base = schemaExportName.replace(/Schema$/i, "").replace(/^./, (s) => s.toUpperCase());

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
