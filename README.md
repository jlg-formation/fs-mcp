# fs-mcp

Serveur MCP : un assistant IA lit et écrit dans un dossier (la **racine**). Démo (POC), pas pour la production.

## Démarrage rapide (HTTP + jeton)

1. **Installer**

   ```bash
   bun install
   ```

2. **Créer le jeton** : copiez `.env-exemple` en `.env` et remplacez la valeur.

   ```
   FSMCP_TOKEN=votre-jeton-secret
   ```

3. **Lancer**
   ```bash
   bun run start:http
   ```
   Adresse : `http://127.0.0.1:1974/mcp` · dossier : `workspace-test`

Autre dossier :

```bash
bun run start:http -- --root "D:/mon-dossier"
```

## Appeler le serveur

Chaque requête doit envoyer :

```
Authorization: Bearer votre-jeton-secret
```

- `200` : accès accordé
- `401` : jeton absent ou faux

## Mode stdio (lancé par l'assistant)

```json
{
  "mcpServers": {
    "fs-mcp": {
      "command": "bun",
      "args": ["run", "C:/chemin/vers/fs-mcp/src/index.ts", "--root", "C:/mon-dossier"]
    }
  }
}
```

Pas de jeton en stdio.

## Options

| Option            | Défaut  | Rôle                                      |
| ----------------- | ------- | ----------------------------------------- |
| `--root <chemin>` | —       | Dossier accessible. **Obligatoire.**      |
| `--transport`     | `stdio` | `stdio` ou `http`                         |
| `--port`          | `1974`  | Port HTTP                                 |
| `--cors`          | off     | En-têtes CORS (HTTP). **Exige un jeton.** |
| `--token`         | —       | Jeton, prioritaire sur `FSMCP_TOKEN`      |

## Outils

- `read_text_file` · `read_binary_file` (base64)
- `write_text_file` · `write_binary_file` (base64)
- `list_directory` · `create_directory` · `delete_directory` (`recursive`)
- `delete_file` · `rename_path`

Tous les chemins sont relatifs à la racine.

## Sécurité

- Accès limité à la racine : pas de chemin absolu, pas de `..`, pas de lien symbolique qui sort.
- Fichiers de plus de 1 Mo refusés.
- Écrasement et suppression sans confirmation, suppression définitive.
- HTTP : écoute sur `127.0.0.1` uniquement, jeton obligatoire.

## Tests

```bash
bun test
```
