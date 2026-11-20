import { describe, expect, test } from "bun:test";
import { mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CliError, loadOptions, parseArgs, resolveRoot, DEFAULT_PORT } from "../src/cli";

describe("parseArgs", () => {
  test("refuse l'absence de --root", () => {
    expect(() => parseArgs([])).toThrow(CliError);
    expect(() => parseArgs(["--transport", "http"])).toThrow(CliError);
  });

  test("refuse --root sans valeur", () => {
    expect(() => parseArgs(["--root"])).toThrow(CliError);
    expect(() => parseArgs(["--root", "--cors"])).toThrow(CliError);
  });

  test("CORS désactivé par défaut", () => {
    expect(parseArgs(["--root", "x"]).cors).toBe(false);
  });

  test("active CORS avec --cors", () => {
    expect(parseArgs(["--root", "x", "--cors"]).cors).toBe(true);
  });

  test("transport stdio par défaut et port 1974", () => {
    const opts = parseArgs(["--root", "x"]);
    expect(opts.transport).toBe("stdio");
    expect(opts.port).toBe(DEFAULT_PORT);
    expect(DEFAULT_PORT).toBe(1974);
  });

  test("accepte --root=valeur", () => {
    expect(parseArgs(["--root=/tmp/x"]).rootArg).toBe("/tmp/x");
  });

  test("refuse un transport inconnu", () => {
    expect(() => parseArgs(["--root", "x", "--transport", "sse"])).toThrow(CliError);
  });

  test("refuse un port invalide", () => {
    expect(() => parseArgs(["--root", "x", "--port", "0"])).toThrow(CliError);
    expect(() => parseArgs(["--root", "x", "--port", "abc"])).toThrow(CliError);
  });

  test("refuse une option inconnue", () => {
    expect(() => parseArgs(["--root", "x", "--foo"])).toThrow(CliError);
  });

  test("accepte --token en deux formes", () => {
    expect(parseArgs(["--root", "x", "--token", "abc"]).token).toBe("abc");
    expect(parseArgs(["--root=x", "--token=abc"]).token).toBe("abc");
  });

  test("refuse --token sans valeur", () => {
    expect(() => parseArgs(["--root", "x", "--token"])).toThrow(CliError);
  });
});

describe("resolveRoot", () => {
  test("refuse une racine inexistante", async () => {
    await expect(resolveRoot(join(tmpdir(), "fs-mcp-inexistant-" + Date.now()))).rejects.toThrow(
      CliError,
    );
  });

  test("refuse une racine qui est un fichier", async () => {
    const dir = realpathSync(mkdtempSync(join(tmpdir(), "cli-")));
    const file = join(dir, "f.txt");
    await Bun.write(file, "x");
    try {
      await expect(resolveRoot(file)).rejects.toThrow(CliError);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("retourne le chemin réel d'une racine valide", async () => {
    const dir = realpathSync(mkdtempSync(join(tmpdir(), "cli-")));
    try {
      expect(await resolveRoot(dir)).toBe(dir);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("loadOptions", () => {
  test("refuse de démarrer sans --root", async () => {
    await expect(loadOptions([])).rejects.toThrow(CliError);
  });

  test("refuse --cors sans jeton, avec la commande corrigée", async () => {
    const dir = realpathSync(mkdtempSync(join(tmpdir(), "cli-")));
    try {
      const err = await loadOptions(["--root", dir, "--cors"], {}).catch((e) => e);
      expect(err).toBeInstanceOf(CliError);
      expect(err.hint).toContain("src/index.ts");
      expect(err.hint).toContain(`--root ${dir} --cors --token <jeton>`);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("lit le jeton dans FSMCP_TOKEN", async () => {
    const dir = realpathSync(mkdtempSync(join(tmpdir(), "cli-")));
    try {
      const opts = await loadOptions(["--root", dir, "--cors"], {
        FSMCP_TOKEN: "env",
      });
      expect(opts.token).toBe("env");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("--token l'emporte sur FSMCP_TOKEN", async () => {
    const dir = realpathSync(mkdtempSync(join(tmpdir(), "cli-")));
    try {
      const opts = await loadOptions(["--root", dir, "--cors", "--token", "cli"], {
        FSMCP_TOKEN: "env",
      });
      expect(opts.token).toBe("cli");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("une valeur FSMCP_TOKEN vide compte comme absente", async () => {
    const dir = realpathSync(mkdtempSync(join(tmpdir(), "cli-")));
    try {
      await expect(loadOptions(["--root", dir, "--cors"], { FSMCP_TOKEN: "" })).rejects.toThrow(
        CliError,
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("sans --cors, le jeton reste optionnel", async () => {
    const dir = realpathSync(mkdtempSync(join(tmpdir(), "cli-")));
    try {
      const opts = await loadOptions(["--root", dir], {});
      expect(opts.token).toBeUndefined();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
