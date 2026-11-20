import { lstat, realpath } from "node:fs/promises";
import { dirname, isAbsolute, join, posix, relative, resolve, sep, win32 } from "node:path";

export class SandboxError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SandboxError";
  }
}

// Returns true when `target` is `root` or lies beneath it.
export function isWithin(root: string, target: string): boolean {
  const rel = relative(root, target);
  if (rel === "") return true;
  if (isAbsolute(rel)) return false;
  return rel !== ".." && !rel.startsWith(".." + sep);
}

function assertRelativeInput(userPath: string): void {
  if (typeof userPath !== "string" || userPath.length === 0) {
    throw new SandboxError("Chemin vide");
  }
  if (isAbsolute(userPath) || posix.isAbsolute(userPath) || win32.isAbsolute(userPath)) {
    throw new SandboxError(`Chemin absolu refusé : ${userPath}`);
  }
  if (userPath.split(/[\\/]+/).includes("..")) {
    throw new SandboxError(`Segment ".." refusé : ${userPath}`);
  }
}

// Nearest ancestor (or the path itself) that exists on disk, without following links.
async function nearestExisting(path: string): Promise<string> {
  let probe = path;
  for (;;) {
    try {
      await lstat(probe);
      return probe;
    } catch {
      const parent = dirname(probe);
      if (parent === probe) throw new SandboxError(`Aucun ancêtre existant : ${path}`);
      probe = parent;
    }
  }
}

// `root` must already be a real (symlink-free) absolute path.
export async function resolveSafePath(root: string, userPath: string): Promise<string> {
  assertRelativeInput(userPath);

  const candidate = resolve(root, userPath);
  if (!isWithin(root, candidate)) {
    throw new SandboxError(`Chemin hors de la racine refusé : ${userPath}`);
  }

  const existing = await nearestExisting(candidate);
  let realExisting: string;
  try {
    realExisting = await realpath(existing);
  } catch {
    throw new SandboxError(`Lien symbolique cassé refusé : ${userPath}`);
  }

  const realFull = join(realExisting, relative(existing, candidate));
  if (!isWithin(root, realFull)) {
    throw new SandboxError(`Chemin hors de la racine refusé (lien symbolique) : ${userPath}`);
  }

  return candidate;
}
