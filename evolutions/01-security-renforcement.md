# Évolution 01 : renforcement de la sécurité (authentification HTTP)

## Besoin

Ajouter une authentification légère au mode HTTP. Le serveur refuse toute requête qui ne présente pas un jeton secret fourni au lancement. Le mode stdio n'est pas concerné.

Motif : avec l'option `--cors`, n'importe quelle origine peut appeler le serveur et lire ses réponses. Un site web ouvert dans le navigateur de l'utilisateur pourrait alors lister, lire, écrire et supprimer des fichiers dans la racine. Le jeton empêche ce scénario.

## Décisions

- **Transmission du jeton** : deux sources acceptées.
  - Option CLI `--token <jeton>`.
  - Variable d'environnement `FSMCP_TOKEN`.
  - La variable d'environnement est recommandée : un argument de ligne de commande reste visible dans l'historique du shell et dans la liste des processus.
- **Format de la requête** : en-tête `Authorization: Bearer <jeton>`.
- **Vérification** : comparaison à temps constant.
- **Portée** :
  - Le jeton est exigé uniquement en mode HTTP.
  - Le jeton est obligatoire dès que l'option `--cors` est utilisée.
  - Hors `--cors`, le jeton reste optionnel en HTTP.
- **Documentation** : les décisions sont consignées dans ce document. `brief-clarified.md` n'est pas modifié à ce stade.

## Points à confirmer

- Si `--token` et `FSMCP_TOKEN` sont tous deux fournis, l'option `--token` a la priorité (proposition).
- Si un jeton est exigé (`--cors`) mais absent, le serveur refuse de démarrer.

## Hors périmètre

- Gestion de plusieurs utilisateurs ou de rôles.
- Rotation ou expiration des jetons.
- Authentification en mode stdio.
