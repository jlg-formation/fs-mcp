# Serveur MCP d'exposition d'un système de fichiers

## Contexte

Un serveur MCP (Model Context Protocol) doit exposer un système de fichiers à un assistant IA. Il sert à des développeurs qui testent un assistant IA en local. Le projet est au stade de l'idée et n'a pas encore d'implémentation.

## Objectif

Permettre à un assistant IA d'effectuer des opérations de gestion de fichiers et de répertoires de façon contrôlée, dans une zone de travail délimitée, afin de tester son comportement en local.

## Périmètre fonctionnel

Le périmètre est identique dès la V1 :

- **Fichiers** : créer, lire, mettre à jour, supprimer, renommer.
- **Répertoires** : créer, lister, supprimer (y compris récursivement sur un répertoire non vide), renommer.
- **Types de contenu** : fichiers texte (UTF-8) et binaires, ces derniers échangés en base64.
- **Création et écrasement** : un fichier existant est écrasé sans confirmation.
- **Suppression** : définitive (pas de corbeille).
- **Accès** : toutes les opérations sont restreintes à un répertoire racine obligatoire (sandbox), fournie par `--root`. Le serveur refuse de démarrer si `--root` est absent ou si le chemin n'existe pas.
- **Validation des chemins** : chaque chemin est résolu puis comparé à la racine réelle (liens symboliques inclus). Les `..`, les chemins absolus et les préfixes trompeurs (par exemple `/racine-2` pour la racine `/racine`) sont refusés. Un nom de fichier contenant `..` ne doit jamais permettre de sortir de la racine.

## Hors périmètre

- Journalisation ou audit des opérations.
- Corbeille ou suppression réversible.
- Accès au système de fichiers en dehors de la racine configurée.
- Usage en production ou multi-utilisateurs.

## Utilisateurs cibles

Développeurs qui testent un assistant IA en local. Ils lancent le serveur et le connectent à leur client MCP.

## Contraintes techniques

- **Langage et runtime** : TypeScript sur Bun.
- **Bibliothèque MCP** : FastMCP (paquet npm `fastmcp`, construit sur le SDK officiel `@modelcontextprotocol/sdk`).
- **Transport MCP** : stdio (lancé par le client) et serveur HTTP. Les deux modes sont requis.
- **HTTP** : écoute sur `127.0.0.1` uniquement. Réponses en JSON classique, sans SSE ni streaming.
- **CORS** : désactivé par défaut. Activé avec l'option `--cors`, qui envoie les en-têtes CORS sur toutes les réponses HTTP. Exige un jeton.
- **Exécution** : en local uniquement.
- **Tests** : tests unitaires uniquement, sans tests d'intégration avec un client MCP. Choix assumé.
- **Journalisation** : aucune exigence.

## Critères de succès

- Toutes les opérations CRUD sur fichiers et répertoires, ainsi que le renommage, fonctionnent.
- Chacune de ces opérations est couverte par des tests unitaires.
- Les opérations hors de la racine configurée sont refusées, y compris avec `..`, liens symboliques ou préfixes trompeurs. Chacun de ces cas est couvert par des tests unitaires.
- Le serveur refuse de démarrer sans `--root`.
- Les fichiers texte et binaires de plus de 1 Mo sont refusés.
- Le serveur fonctionne en mode stdio et en mode HTTP.
- En HTTP avec jeton, une requête sans `Authorization: Bearer <jeton>` valide reçoit une réponse 401. Avec `--cors` sans jeton, le serveur refuse de démarrer et affiche la commande corrigée.

## Paramètres de configuration

- **Racine** : argument CLI obligatoire `--root <chemin>`.
- **CORS** : option `--cors`, désactivée par défaut. Exige un jeton (`--token` ou `FSMCP_TOKEN`).
- **Taille maximale** : 1 Mo, pour les fichiers texte comme pour les binaires.
- **Port HTTP** : 1974 par défaut.
- **Adresse HTTP** : `127.0.0.1` uniquement.
- **Authentification HTTP** : jeton secret, transmis par `--token` (prioritaire) ou `FSMCP_TOKEN`, envoyé en en-tête `Authorization: Bearer <jeton>`. Obligatoire avec `--cors`, optionnel sinon. Projet de démonstration (MVP/POC) pour une formation, non destiné à la production. Hors périmètre : plusieurs utilisateurs, rotation ou expiration des jetons, authentification en stdio.
