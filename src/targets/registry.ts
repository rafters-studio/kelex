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

/** Register a custom target. Throws if name is already taken unless force is set. */
export function registerTarget(
  target: CodegenTarget,
  opts?: { force?: boolean },
): void {
  if (!opts?.force && builtinTargets.has(target.name)) {
    throw new Error(
      `Target "${target.name}" is already registered. Pass { force: true } to override.`,
    );
  }
  builtinTargets.set(target.name, target);
}

/** Remove a registered target by name. No-op if not found. */
export function unregisterTarget(name: string): void {
  builtinTargets.delete(name);
}
