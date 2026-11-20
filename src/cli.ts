import { realpath, stat } from "node:fs/promises";

export const DEFAULT_PORT = 1974;

export interface Options {
  root: string;
  cors: boolean;
  transport: "stdio" | "http";
  port: number;
  token?: string;
}

export class CliError extends Error {
  readonly hint?: string;

  constructor(message: string, hint?: string) {
    super(message);
    this.name = "CliError";
    this.hint = hint;
  }
}

export interface RawOptions {
  rootArg?: string;
  cors: boolean;
  transport: "stdio" | "http";
  port: number;
  token?: string;
}

export function parseArgs(argv: string[]): RawOptions {
  const out: RawOptions = {
    cors: false,
    transport: "stdio",
    port: DEFAULT_PORT,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const [flag, inline] = arg.includes("=")
      ? [arg.slice(0, arg.indexOf("=")), arg.slice(arg.indexOf("=") + 1)]
      : [arg, undefined];
    const next = () => {
      if (inline !== undefined) return inline;
      const value = argv[++i];
      if (value === undefined || value.startsWith("--"))
        throw new CliError(`Valeur manquante pour ${flag}`);
      return value;
    };

    switch (flag) {
      case "--root":
        out.rootArg = next();
        break;
      case "--cors":
        out.cors = true;
        break;
      case "--token":
        out.token = next();
        break;
      case "--transport": {
        const value = next();
        if (value !== "stdio" && value !== "http")
          throw new CliError(`Transport inconnu : ${value}`);
        out.transport = value;
        break;
      }
      case "--port": {
        const port = Number(next());
        if (!Number.isInteger(port) || port < 1 || port > 65535)
          throw new CliError("Port invalide");
        out.port = port;
        break;
      }
      default:
        throw new CliError(`Option inconnue : ${arg}`);
    }
  }

  if (out.rootArg === undefined) {
    throw new CliError("Option --root obligatoire");
  }
  return out;
}

// Resolves the root to its real path and checks that it is an existing directory.
export async function resolveRoot(rootArg: string): Promise<string> {
  let real: string;
  try {
    real = await realpath(rootArg);
  } catch {
    throw new CliError(`La racine n'existe pas : ${rootArg}`);
  }
  if (!(await stat(real)).isDirectory()) {
    throw new CliError(`La racine n'est pas un répertoire : ${rootArg}`);
  }
  return real;
}

export async function loadOptions(
  argv: string[],
  env: Record<string, string | undefined> = process.env,
): Promise<Options> {
  const raw = parseArgs(argv);
  const root = await resolveRoot(raw.rootArg as string);
  // --token prime sur FSMCP_TOKEN ; une valeur vide compte comme absente.
  const token = raw.token || env.FSMCP_TOKEN || undefined;
  if (raw.cors && !token) {
    const command = argv.map((arg) => (/\s/.test(arg) ? `"${arg}"` : arg));
    throw new CliError(
      "--cors exige un jeton (option --token ou variable FSMCP_TOKEN)",
      `Commande corrigée : bun run src/index.ts ${command.join(" ")} --token <jeton>`,
    );
  }
  return {
    root,
    cors: raw.cors,
    transport: raw.transport,
    port: raw.port,
    token,
  };
}
