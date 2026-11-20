import {
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  rmdir,
  stat,
  lstat,
  unlink,
  writeFile,
} from "node:fs/promises";
import { resolveSafePath, SandboxError } from "./sandbox";
import { assertWithinLimit, base64ByteLength } from "./limits";

export type EntryType = "file" | "directory" | "symlink" | "other";

export interface DirEntry {
  name: string;
  type: EntryType;
}

export class FsOpError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FsOpError";
  }
}

async function existsNoFollow(abs: string): Promise<boolean> {
  try {
    await lstat(abs);
    return true;
  } catch {
    return false;
  }
}

async function readRegularFile(root: string, p: string): Promise<Buffer> {
  const abs = await resolveSafePath(root, p);
  const st = await stat(abs);
  if (!st.isFile()) throw new FsOpError(`Pas un fichier : ${p}`);
  assertWithinLimit(st.size, `Le fichier ${p}`);
  return readFile(abs);
}

export async function readTextFile(root: string, p: string): Promise<string> {
  return (await readRegularFile(root, p)).toString("utf8");
}

export async function readBinaryFile(root: string, p: string): Promise<string> {
  return (await readRegularFile(root, p)).toString("base64");
}

export async function writeTextFile(
  root: string,
  p: string,
  content: string,
): Promise<void> {
  assertWithinLimit(Buffer.byteLength(content, "utf8"), `Le contenu de ${p}`);
  const abs = await resolveSafePath(root, p);
  if (await isDirectory(abs)) throw new FsOpError(`Est un répertoire : ${p}`);
  await writeFile(abs, content, "utf8");
}

export async function writeBinaryFile(
  root: string,
  p: string,
  base64: string,
): Promise<void> {
  assertWithinLimit(base64ByteLength(base64), `Le contenu de ${p}`);
  const data = Buffer.from(base64, "base64");
  const abs = await resolveSafePath(root, p);
  if (await isDirectory(abs)) throw new FsOpError(`Est un répertoire : ${p}`);
  await writeFile(abs, data);
}

export async function deleteFile(root: string, p: string): Promise<void> {
  const abs = await resolveSafePath(root, p);
  const st = await lstat(abs);
  if (st.isDirectory())
    throw new FsOpError(`Est un répertoire, utiliser delete_directory : ${p}`);
  await unlink(abs);
}

export async function createDirectory(root: string, p: string): Promise<void> {
  const abs = await resolveSafePath(root, p);
  await mkdir(abs);
}

export async function listDirectory(
  root: string,
  p: string,
): Promise<DirEntry[]> {
  const abs = await resolveSafePath(root, p);
  const st = await stat(abs);
  if (!st.isDirectory()) throw new FsOpError(`Pas un répertoire : ${p}`);
  const dirents = await readdir(abs, { withFileTypes: true });
  return dirents.map((d) => ({
    name: d.name,
    type: d.isFile()
      ? "file"
      : d.isDirectory()
        ? "directory"
        : d.isSymbolicLink()
          ? "symlink"
          : "other",
  }));
}

export async function deleteDirectory(
  root: string,
  p: string,
  recursive: boolean,
): Promise<void> {
  const abs = await resolveSafePath(root, p);
  if (abs === root) throw new SandboxError("Suppression de la racine refusée");
  const st = await lstat(abs);
  if (!st.isDirectory()) throw new FsOpError(`Pas un répertoire : ${p}`);
  if (recursive) {
    await rm(abs, { recursive: true, force: false });
  } else {
    await rmdir(abs);
  }
}

// Renames a file or a directory. Refuses to overwrite an existing target.
export async function renamePath(
  root: string,
  from: string,
  to: string,
): Promise<void> {
  const absFrom = await resolveSafePath(root, from);
  const absTo = await resolveSafePath(root, to);
  if (absFrom === root) throw new SandboxError("Renommage de la racine refusé");
  if (!(await existsNoFollow(absFrom)))
    throw new FsOpError(`Source introuvable : ${from}`);
  if (await existsNoFollow(absTo))
    throw new FsOpError(`La cible existe déjà : ${to}`);
  await rename(absFrom, absTo);
}

async function isDirectory(abs: string): Promise<boolean> {
  try {
    return (await stat(abs)).isDirectory();
  } catch {
    return false;
  }
}
