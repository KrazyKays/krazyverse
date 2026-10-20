# Krazyverse

Jeu narratif d'exploration multiverselle : une toile de personnages, de lieux et d'événements à révéler à travers plusieurs univers parallèles, jusqu'à la résolution d'une question centrale sur une anomalie du multivers.

Application statique (React + TypeScript + Vite), sans backend ni service externe. La progression est sauvegardée localement dans le navigateur.

## Prérequis

- Node.js 24 (ou une version LTS récente compatible avec Vite 8).
- npm 11 ou supérieur.
- Git.

## Installation

```bash
npm ci
```

## Démarrage local

```bash
npm run dev
```

Puis ouvrir l'adresse affichée dans le terminal (par défaut `http://localhost:5173/`).

## Commandes

| Commande | Rôle |
| --- | --- |
| `npm run dev` | Serveur de développement |
| `npm run typecheck` | Vérification TypeScript stricte |
| `npm test` | Tests unitaires de la logique métier |
| `npm run build` | Vérification TypeScript puis build de production dans `dist/` |
| `npm run preview` | Prévisualisation du build de production |

## Structure

- `src/data/` : contenu narratif (univers, nœuds, relations, échos, questions).
- `src/domain/` : types, règles de visibilité, révélations, échos et progression. Indépendant de React.
- `src/storage/` : sauvegarde versionnée dans `localStorage` (clé `multiverse-game-save-v1`), avec validation et repli en mémoire.
- `src/hooks/` : hook de jeu qui relie l'état métier et la sauvegarde.
- `src/components/` : interface React (graphe SVG, panneau de lecture, dialogues).
- `src/tests/` : tests de la logique métier.
- `.github/workflows/deploy.yml` : vérifications et déploiement GitHub Pages.

## Mise en ligne sur GitHub

```bash
git add .
git commit -m "Initialise le jeu narratif multiversel"
git branch -M main
git remote add origin https://github.com/<UTILISATEUR>/<NOM_DU_REPO>.git
git push -u origin main
```

## Chemin de base (GitHub Pages)

Le site est servi sous `https://<UTILISATEUR>.github.io/<NOM_DU_REPO>/`. Dans `vite.config.ts`, la valeur `base` vaut `/<NOM_DU_REPO>/` lorsque le build s'exécute dans GitHub Actions (variable `GITHUB_ACTIONS`), et `/` en local.

Le nom du dépôt est `krazyverse` par défaut. S'il est différent, définir la variable `VITE_REPO_NAME` dans le workflow, ou modifier la valeur par défaut dans `vite.config.ts`.

## Activer GitHub Pages

1. Ouvrir **Settings → Pages**.
2. Dans **Build and deployment**, choisir **Source : GitHub Actions**.
3. Pousser sur `main` : le workflow `Deploy to GitHub Pages` construit et publie le site.

## En cas d'échec du déploiement

- **Onglet Actions** : ouvrir le run échoué et lire l'étape en erreur (installation, typecheck, tests, build ou déploiement).
- **Erreur `Get Pages site failed` ou `Pages not enabled`** : vérifier que Pages est activé avec la source GitHub Actions.
- **Erreur de permissions sur `deploy-pages`** : vérifier que le workflow garde `pages: write` et `id-token: write` sur le job de déploiement, et que le dépôt autorise les workflows à écrire.
- **Page blanche ou assets en 404** : vérifier que l'URL contient bien le nom du dépôt et que `base` correspond à ce nom.
- **Branche absente** : le déploiement ne se déclenche que sur `main`.

## Sauvegarde locale

La progression est stockée dans `localStorage` sous la clé `multiverse-game-save-v1`. Un bouton **Réinitialiser** (avec confirmation) efface cette sauvegarde. Si le stockage est indisponible, le jeu continue en mémoire et l'interface l'indique.
