import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import {
  mkdtempSync,
  mkdirSync,
  rmSync,
  writeFileSync,
  existsSync,
  realpathSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as ops from "../src/fs-ops";
import { SandboxError } from "../src/sandbox";

let root: string;

beforeEach(() => {
  root = realpathSync(mkdtempSync(join(tmpdir(), "dirs-")));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("création de répertoire", () => {
  test("crée un répertoire", async () => {
    await ops.createDirectory(root, "d");
    expect(existsSync(join(root, "d"))).toBe(true);
  });

  test("refuse si le répertoire existe déjà", async () => {
    mkdirSync(join(root, "d"));
    await expect(ops.createDirectory(root, "d")).rejects.toThrow();
  });

  test("refuse si le parent n'existe pas", async () => {
    await expect(ops.createDirectory(root, "p/d")).rejects.toThrow();
  });

  test("refuse hors racine", async () => {
    await expect(ops.createDirectory(root, "../d")).rejects.toThrow(
      SandboxError,
    );
  });
});

describe("listage", () => {
  test("liste fichiers et répertoires avec leur type", async () => {
    mkdirSync(join(root, "d"));
    writeFileSync(join(root, "f.txt"), "x");
    const entries = await ops.listDirectory(root, ".");
    expect(entries).toContainEqual({ name: "d", type: "directory" });
    expect(entries).toContainEqual({ name: "f.txt", type: "file" });
  });

  test("liste un répertoire vide", async () => {
    mkdirSync(join(root, "d"));
    expect(await ops.listDirectory(root, "d")).toEqual([]);
  });

  test("refuse de lister un fichier", async () => {
    writeFileSync(join(root, "f.txt"), "x");
    await expect(ops.listDirectory(root, "f.txt")).rejects.toThrow();
  });
});

describe("suppression de répertoire", () => {
  test("supprime un répertoire vide sans récursion", async () => {
    mkdirSync(join(root, "d"));
    await ops.deleteDirectory(root, "d", false);
    expect(existsSync(join(root, "d"))).toBe(false);
  });

  test("refuse un répertoire non vide sans récursion", async () => {
    mkdirSync(join(root, "d"));
    writeFileSync(join(root, "d", "f.txt"), "x");
    await expect(ops.deleteDirectory(root, "d", false)).rejects.toThrow();
    expect(existsSync(join(root, "d", "f.txt"))).toBe(true);
  });

  test("supprime un répertoire non vide récursivement", async () => {
    mkdirSync(join(root, "d", "e"), { recursive: true });
    writeFileSync(join(root, "d", "e", "f.txt"), "x");
    await ops.deleteDirectory(root, "d", true);
    expect(existsSync(join(root, "d"))).toBe(false);
  });

  test("refuse de supprimer la racine", async () => {
    await expect(ops.deleteDirectory(root, ".", true)).rejects.toThrow(
      SandboxError,
    );
    expect(existsSync(root)).toBe(true);
  });

  test("refuse de supprimer hors racine", async () => {
    await expect(ops.deleteDirectory(root, "..", true)).rejects.toThrow(
      SandboxError,
    );
  });
});

describe("renommage de répertoire", () => {
  test("renomme un répertoire non vide", async () => {
    mkdirSync(join(root, "d"));
    writeFileSync(join(root, "d", "f.txt"), "x");
    await ops.renamePath(root, "d", "e");
    expect(existsSync(join(root, "d"))).toBe(false);
    expect(existsSync(join(root, "e", "f.txt"))).toBe(true);
  });

  test("refuse de renommer la racine", async () => {
    await expect(ops.renamePath(root, ".", "x")).rejects.toThrow(SandboxError);
  });

  test("refuse de déplacer un répertoire hors racine", async () => {
    mkdirSync(join(root, "d"));
    await expect(ops.renamePath(root, "d", "../d")).rejects.toThrow(
      SandboxError,
    );
    expect(existsSync(join(root, "d"))).toBe(true);
  });
});
