import { compositeTarget } from "./composite";
import { reactTanStackTarget } from "./react-tanstack";
import type { CodegenTarget } from "./types";

const builtinTargets = new Map<string, CodegenTarget>([
  [reactTanStackTarget.name, reactTanStackTarget],
  [compositeTarget.name, compositeTarget],
]);

/** Resolve a target by name. Throws if not found. */
export function resolveTarget(name: string): CodegenTarget {
  const target = builtinTargets.get(name);
  if (!target) {
    const available = [...builtinTargets.keys()].join(", ");
    throw new Error(
      `Unknown target "${name}". Available targets: ${available}`,
    );
  }
  return target;
}

/** List all registered targets. */
export function listTargets(): CodegenTarget[] {
  return [...builtinTargets.values()];
}

/** Register a custom target. */
export function registerTarget(target: CodegenTarget): void {
  builtinTargets.set(target.name, target);
}
