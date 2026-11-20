import { FastMCP, UserError } from "fastmcp";
import { z } from "zod";
import * as ops from "./fs-ops";

const pathParam = z.string().describe("Chemin relatif à la racine configurée");

async function run<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    throw new UserError(err instanceof Error ? err.message : String(err));
  }
}

export function registerTools(server: FastMCP, root: string): void {
  server.addTool({
    name: "read_text_file",
    description: "Lire un fichier texte UTF-8 (max 1 Mo)",
    parameters: z.object({ path: pathParam }),
    execute: async ({ path }) => run(() => ops.readTextFile(root, path)),
  });

  server.addTool({
    name: "read_binary_file",
    description: "Lire un fichier binaire, retourné en base64 (max 1 Mo)",
    parameters: z.object({ path: pathParam }),
    execute: async ({ path }) => run(() => ops.readBinaryFile(root, path)),
  });

  server.addTool({
    name: "write_text_file",
    description:
      "Créer ou écraser un fichier texte UTF-8 (max 1 Mo). Le répertoire parent doit exister",
    parameters: z.object({ path: pathParam, content: z.string() }),
    execute: async ({ path, content }) => {
      await run(() => ops.writeTextFile(root, path, content));
      return `Fichier écrit : ${path}`;
    },
  });

  server.addTool({
    name: "write_binary_file",
    description:
      "Créer ou écraser un fichier binaire fourni en base64 (max 1 Mo). Le répertoire parent doit exister",
    parameters: z.object({ path: pathParam, contentBase64: z.string() }),
    execute: async ({ path, contentBase64 }) => {
      await run(() => ops.writeBinaryFile(root, path, contentBase64));
      return `Fichier écrit : ${path}`;
    },
  });

  server.addTool({
    name: "delete_file",
    description: "Supprimer définitivement un fichier",
    parameters: z.object({ path: pathParam }),
    execute: async ({ path }) => {
      await run(() => ops.deleteFile(root, path));
      return `Fichier supprimé : ${path}`;
    },
  });

  server.addTool({
    name: "create_directory",
    description:
      "Créer un répertoire. Le parent doit exister et le répertoire ne doit pas exister",
    parameters: z.object({ path: pathParam }),
    execute: async ({ path }) => {
      await run(() => ops.createDirectory(root, path));
      return `Répertoire créé : ${path}`;
    },
  });

  server.addTool({
    name: "list_directory",
    description: "Lister le contenu d'un répertoire",
    parameters: z.object({ path: pathParam }),
    execute: async ({ path }) =>
      JSON.stringify(await run(() => ops.listDirectory(root, path))),
  });

  server.addTool({
    name: "delete_directory",
    description:
      "Supprimer définitivement un répertoire, récursivement si recursive=true",
    parameters: z.object({
      path: pathParam,
      recursive: z.boolean().default(false),
    }),
    execute: async ({ path, recursive }) => {
      await run(() => ops.deleteDirectory(root, path, recursive));
      return `Répertoire supprimé : ${path}`;
    },
  });

  server.addTool({
    name: "rename_path",
    description:
      "Renommer ou déplacer un fichier ou un répertoire. Refuse d'écraser une cible existante",
    parameters: z.object({ from: pathParam, to: pathParam }),
    execute: async ({ from, to }) => {
      await run(() => ops.renamePath(root, from, to));
      return `Renommé : ${from} -> ${to}`;
    },
  });
}
