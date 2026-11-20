import { describe, expect, test, beforeAll, afterAll } from "bun:test";
import {
  mkdtempSync,
  mkdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
  realpathSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolveSafePath, SandboxError } from "../src/sandbox";

let base: string;
let root: string;
let outside: string;

// Symlink creation needs Developer Mode or admin rights on Windows.
const canSymlink = (() => {
  const probeDir = mkdtempSync(join(tmpdir(), "symlink-probe-"));
  try {
    symlinkSync(probeDir, join(probeDir, "link"));
    return true;
  } catch {
    return false;
  } finally {
    rmSync(probeDir, { recursive: true, force: true });
  }
})();

beforeAll(() => {
  base = realpathSync(mkdtempSync(join(tmpdir(), "sandbox-")));
  root = join(base, "racine");
  outside = join(base, "racine-2");
  mkdirSync(root);
  mkdirSync(outside);
  writeFileSync(join(outside, "secret.txt"), "secret");
  mkdirSync(join(root, "sub"));
  if (canSymlink) {
    symlinkSync(join(outside, "secret.txt"), join(root, "lien-fichier"));
    symlinkSync(outside, join(root, "lien-dossier"), "junction");
    symlinkSync(join(base, "inexistant"), join(root, "lien-casse"));
  }
});

afterAll(() => {
  rmSync(base, { recursive: true, force: true });
});

describe("resolveSafePath : chemins valides", () => {
  test("accepte un chemin simple", async () => {
    expect(await resolveSafePath(root, "fichier.txt")).toBe(
      join(root, "fichier.txt"),
    );
  });

  test("accepte un sous-chemin existant", async () => {
    expect(await resolveSafePath(root, "sub/a.txt")).toBe(
      join(root, "sub", "a.txt"),
    );
  });

  test("accepte un nom contenant '..' sans segment '..'", async () => {
    expect(await resolveSafePath(root, "a..b.txt")).toBe(
      join(root, "a..b.txt"),
    );
  });

  test("accepte la racine elle-même via '.'", async () => {
    expect(await resolveSafePath(root, ".")).toBe(root);
  });
});

describe("resolveSafePath : refus lexicaux", () => {
  test("refuse '..' seul", async () => {
    await expect(resolveSafePath(root, "..")).rejects.toThrow(SandboxError);
  });

  test("refuse '..' au milieu d'un chemin qui reste dans la racine", async () => {
    await expect(resolveSafePath(root, "sub/../fichier.txt")).rejects.toThrow(
      SandboxError,
    );
  });

  test("refuse '..' avec séparateur Windows", async () => {
    await expect(resolveSafePath(root, "..\\secret.txt")).rejects.toThrow(
      SandboxError,
    );
  });

  test("refuse un chemin absolu POSIX", async () => {
    await expect(resolveSafePath(root, "/etc/passwd")).rejects.toThrow(
      SandboxError,
    );
  });

  test("refuse un chemin absolu Windows", async () => {
    await expect(resolveSafePath(root, "C:\\Windows\\win.ini")).rejects.toThrow(
      SandboxError,
    );
  });

  test("refuse un chemin vide", async () => {
    await expect(resolveSafePath(root, "")).rejects.toThrow(SandboxError);
  });
});

describe("resolveSafePath : préfixes trompeurs", () => {
  test("refuse un chemin frère dont le nom commence par celui de la racine", async () => {
    await expect(
      resolveSafePath(root, "../racine-2/secret.txt"),
    ).rejects.toThrow(SandboxError);
  });
});

describe("resolveSafePath : liens symboliques", () => {
  test.skipIf(!canSymlink)(
    "refuse un fichier existant lié vers l'extérieur",
    async () => {
      await expect(resolveSafePath(root, "lien-fichier")).rejects.toThrow(
        SandboxError,
      );
    },
  );

  test.skipIf(!canSymlink)(
    "refuse un répertoire lié vers l'extérieur",
    async () => {
      await expect(
        resolveSafePath(root, "lien-dossier/secret.txt"),
      ).rejects.toThrow(SandboxError);
    },
  );

  test.skipIf(!canSymlink)(
    "refuse une cible inexistante dont l'ancêtre est un lien externe",
    async () => {
      await expect(
        resolveSafePath(root, "lien-dossier/nouveau.txt"),
      ).rejects.toThrow(SandboxError);
    },
  );

  test.skipIf(!canSymlink)("refuse un lien symbolique cassé", async () => {
    await expect(resolveSafePath(root, "lien-casse")).rejects.toThrow(
      SandboxError,
    );
  });
});
