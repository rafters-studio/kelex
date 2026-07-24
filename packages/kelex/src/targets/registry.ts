import { compositeTarget } from "./composite";
import type { CodegenTarget } from "./types";

const BUILTIN_NAMES = new Set([compositeTarget.name]);

const targets = new Map<string, CodegenTarget>([[compositeTarget.name, compositeTarget]]);

/** Resolve a target by name. Throws if not found. */
export function resolveTarget(name: string): CodegenTarget {
  const target = targets.get(name);
  if (!target) {
    const available = [...targets.keys()].join(", ");
    throw new Error(`Unknown target "${name}". Available targets: ${available}`);
  }
  return target;
}

/** List all registered targets. */
export function listTargets(): CodegenTarget[] {
  return [...targets.values()];
}

/** Register a custom target. Throws if name is already taken unless force is set. */
export function registerTarget(target: CodegenTarget, opts?: { force?: boolean }): void {
  if (!opts?.force && targets.has(target.name)) {
    throw new Error(
      `Target "${target.name}" is already registered. Pass { force: true } to override.`,
    );
  }
  targets.set(target.name, target);
}

/** Remove a registered target by name. Cannot remove built-in targets. */
export function unregisterTarget(name: string): void {
  if (BUILTIN_NAMES.has(name)) {
    throw new Error(`Cannot unregister built-in target "${name}".`);
  }
  targets.delete(name);
}
