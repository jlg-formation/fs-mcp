import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  realpathSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as ops from "../src/fs-ops";
import { MAX_BYTES, LimitError, base64ByteLength } from "../src/limits";
import { SandboxError } from "../src/sandbox";

let root: string;

beforeEach(() => {
  root = realpathSync(mkdtempSync(join(tmpdir(), "files-")));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("fichiers texte", () => {
  test("création puis lecture UTF-8", async () => {
    await ops.writeTextFile(root, "a.txt", "héllo ✓");
    expect(await ops.readTextFile(root, "a.txt")).toBe("héllo ✓");
  });

  test("écrasement d'un fichier existant sans confirmation", async () => {
    await ops.writeTextFile(root, "a.txt", "v1");
    await ops.writeTextFile(root, "a.txt", "v2");
    expect(readFileSync(join(root, "a.txt"), "utf8")).toBe("v2");
  });

  test("mise à jour via écrasement", async () => {
    writeFileSync(join(root, "a.txt"), "avant");
    await ops.writeTextFile(root, "a.txt", "après");
    expect(await ops.readTextFile(root, "a.txt")).toBe("après");
  });

  test("suppression", async () => {
    writeFileSync(join(root, "a.txt"), "x");
    await ops.deleteFile(root, "a.txt");
    expect(existsSync(join(root, "a.txt"))).toBe(false);
  });

  test("suppression d'un fichier absent échoue", async () => {
    await expect(ops.deleteFile(root, "absent.txt")).rejects.toThrow();
  });

  test("refus d'écrire un contenu de plus de 1 Mo", async () => {
    const content = "a".repeat(MAX_BYTES + 1);
    await expect(ops.writeTextFile(root, "big.txt", content)).rejects.toThrow(LimitError);
    expect(existsSync(join(root, "big.txt"))).toBe(false);
  });

  test("accepte un contenu d'exactement 1 Mo", async () => {
    await ops.writeTextFile(root, "max.txt", "a".repeat(MAX_BYTES));
    expect((await ops.readTextFile(root, "max.txt")).length).toBe(MAX_BYTES);
  });

  test("refus de lire un fichier de plus de 1 Mo", async () => {
    writeFileSync(join(root, "big.txt"), Buffer.alloc(MAX_BYTES + 1, 97));
    await expect(ops.readTextFile(root, "big.txt")).rejects.toThrow(LimitError);
  });

  test("refus d'écrire hors racine", async () => {
    await expect(ops.writeTextFile(root, "../evil.txt", "x")).rejects.toThrow(SandboxError);
  });

  test("refus de lire un répertoire comme fichier", async () => {
    mkdirSync(join(root, "d"));
    await expect(ops.readTextFile(root, "d")).rejects.toThrow();
  });
});

describe("fichiers binaires", () => {
  test("écriture base64 puis lecture base64 à l'identique", async () => {
    const bytes = Buffer.from([0, 1, 2, 250, 255]);
    await ops.writeBinaryFile(root, "b.bin", bytes.toString("base64"));
    expect(readFileSync(join(root, "b.bin"))).toEqual(bytes);
    expect(await ops.readBinaryFile(root, "b.bin")).toBe(bytes.toString("base64"));
  });

  test("refus d'écrire un base64 décodant à plus de 1 Mo", async () => {
    const b64 = Buffer.alloc(MAX_BYTES + 1, 1).toString("base64");
    await expect(ops.writeBinaryFile(root, "big.bin", b64)).rejects.toThrow(LimitError);
    expect(existsSync(join(root, "big.bin"))).toBe(false);
  });

  test("refus de lire un binaire de plus de 1 Mo", async () => {
    writeFileSync(join(root, "big.bin"), Buffer.alloc(MAX_BYTES + 1, 1));
    await expect(ops.readBinaryFile(root, "big.bin")).rejects.toThrow(LimitError);
  });

  test("calcul de la taille décodée base64", () => {
    expect(base64ByteLength(Buffer.from("abc").toString("base64"))).toBe(3);
    expect(base64ByteLength(Buffer.from("ab").toString("base64"))).toBe(2);
    expect(base64ByteLength(Buffer.from("a").toString("base64"))).toBe(1);
  });
});

describe("renommage de fichier", () => {
  test("renomme un fichier", async () => {
    writeFileSync(join(root, "a.txt"), "x");
    await ops.renamePath(root, "a.txt", "b.txt");
    expect(existsSync(join(root, "a.txt"))).toBe(false);
    expect(readFileSync(join(root, "b.txt"), "utf8")).toBe("x");
  });

  test("refuse d'écraser une cible existante", async () => {
    writeFileSync(join(root, "a.txt"), "x");
    writeFileSync(join(root, "b.txt"), "y");
    await expect(ops.renamePath(root, "a.txt", "b.txt")).rejects.toThrow();
    expect(readFileSync(join(root, "b.txt"), "utf8")).toBe("y");
  });

  test("refuse un renommage vers l'extérieur", async () => {
    writeFileSync(join(root, "a.txt"), "x");
    await expect(ops.renamePath(root, "a.txt", "../a.txt")).rejects.toThrow(SandboxError);
    expect(existsSync(join(root, "a.txt"))).toBe(true);
  });
});
