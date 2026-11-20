# fs-mcp

Serveur MCP (Model Context Protocol) qui expose un répertoire local à un assistant IA, dans une zone de travail confinée. Projet de démonstration (POC) pour tester un assistant en local. Ne pas utiliser en production.

## Prérequis

- [Bun](https://bun.sh)

## Installation

```bash
bun install
```

## Lancement

La racine `--root` est obligatoire. Le serveur refuse de démarrer si elle est absente ou si le chemin n'existe pas.

| Option                    | Défaut    | Description                                       |
| ------------------------- | --------- | ------------------------------------------------- |
| `--root <chemin>`         | (aucun)   | Répertoire racine de la sandbox (obligatoire)     |
| `--transport stdio\|http` | `stdio`   | Mode de transport                                 |
| `--port <n>`              | `1974`    | Port HTTP (mode `http` uniquement)                |
| `--cors`                  | désactivé | Envoie les en-têtes CORS (mode `http` uniquement) |

## Mode stdio

Le client lance le serveur lui-même. Exemple de configuration :

```json
{
  "mcpServers": {
    "fs-mcp": {
      "command": "bun",
      "args": [
        "run",
        "D:\\____GIA\\fs-mcp\\src\\index.ts",
        "--root",
        "D:\\workspace-test"
      ]
    }
  }
}
```

## Mode HTTP avec CORS

Lancer le serveur :

```bash
bun run start:http -- --root ./workspace-test
```

Le script `start:http` ajoute `--transport http --port 1974 --cors`. Le `--` est nécessaire pour transmettre `--root` au serveur.

Le serveur écoute uniquement sur `127.0.0.1` et expose l'endpoint MCP :

```
http://127.0.0.1:1974/mcp
```

Les réponses sont en JSON classique (pas de SSE). Sans `--cors`, aucun en-tête CORS n'est envoyé. Avec `--cors`, chaque réponse HTTP contient `Access-Control-Allow-Origin: *`, ce qui permet d'appeler le serveur depuis une page web servie sur une autre origine.

Vérification rapide :

```powershell
Invoke-WebRequest -Uri http://127.0.0.1:1974/mcp -Method Post `
  -Headers @{ 'Content-Type'='application/json'; 'Accept'='application/json, text/event-stream'; 'Origin'='http://localhost:5173' } `
  -Body '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"test","version":"1"}}}' `
  -UseBasicParsing
```

Dans la réponse, l'en-tête `Access-Control-Allow-Origin` doit être présent.

Pour un client MCP qui se connecte par URL, indiquer `http://127.0.0.1:1974/mcp` comme adresse du serveur. La syntaxe exacte dépend du client.

## Outils exposés

| Outil               | Rôle                                                              |
| ------------------- | ----------------------------------------------------------------- |
| `read_text_file`    | Lire un fichier texte UTF-8                                       |
| `read_binary_file`  | Lire un fichier binaire, retourné en base64                       |
| `write_text_file`   | Créer ou écraser un fichier texte (`path`, `content`)             |
| `write_binary_file` | Créer ou écraser un fichier binaire (`path`, `contentBase64`)     |
| `delete_file`       | Supprimer un fichier (définitif)                                  |
| `create_directory`  | Créer un répertoire                                               |
| `list_directory`    | Lister un répertoire                                              |
| `delete_directory`  | Supprimer un répertoire (`recursive` pour un répertoire non vide) |
| `rename_path`       | Renommer ou déplacer un fichier ou un répertoire (`from`, `to`)   |

Tous les chemins sont relatifs à la racine.

## Règles de sécurité

- Les chemins absolus, les segments `..` et les liens symboliques pointant hors de la racine sont refusés.
- Les fichiers texte et binaires de plus de 1 Mo sont refusés, en lecture comme en écriture.
- Un fichier existant est écrasé sans confirmation. La suppression est définitive.
- Le renommage refuse d'écraser une cible existante.
- Le parent doit exister pour une écriture ou une création de répertoire.
- Aucune authentification en mode HTTP.

## Tests

```bash
bun test
```

Les tests de liens symboliques sont ignorés sous Windows si la création de liens est refusée (`EPERM`). Activer le mode développeur ou lancer le terminal en administrateur pour les exécuter.
