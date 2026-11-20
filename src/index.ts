#!/usr/bin/env bun
import type { IncomingMessage } from "node:http";
import { timingSafeEqual } from "node:crypto";
import { FastMCP } from "fastmcp";
import { CliError, loadOptions } from "./cli";
import { registerTools } from "./tools";

// stdout carries the MCP protocol in stdio mode, so errors go to stderr.
let options;
try {
  options = await loadOptions(process.argv.slice(2));
} catch (err) {
  const message = err instanceof CliError ? err.message : String(err);
  console.error(`Erreur : ${message}`);
  if (err instanceof CliError && err.hint) console.error(err.hint);
  console.error(
    "Usage : bun run src/index.ts --root <chemin> [--transport stdio|http] [--port 1974] [--cors] [--token <jeton>]",
  );
  process.exit(1);
}

const token = options.token;

// Comparaison en temps constant de l'en-tête Authorization attendu.
function hasValidBearer(request: IncomingMessage, expected: string): boolean {
  const received = Buffer.from(request.headers.authorization ?? "");
  const wanted = Buffer.from(`Bearer ${expected}`);
  return received.length === wanted.length && timingSafeEqual(received, wanted);
}

const server = new FastMCP({
  name: "fs-mcp",
  version: "0.1.0",
  authenticate:
    options.transport === "http" && token !== undefined
      ? async (request) => ({
          authenticated: hasValidBearer(request, token),
          error: "Jeton absent ou invalide",
        })
      : undefined,
});
registerTools(server, options.root);

if (options.transport === "http") {
  await server.start({
    transportType: "httpStream",
    httpStream: {
      host: "127.0.0.1",
      port: options.port,
      cors: options.cors,
      enableJsonResponse: true,
    },
  });
  console.error(`fs-mcp HTTP sur http://127.0.0.1:${options.port}/mcp (racine : ${options.root})`);
} else {
  await server.start({ transportType: "stdio" });
}
