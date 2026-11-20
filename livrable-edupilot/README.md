# ÉduPilot — dossier livrable autonome

Ce dossier contient **tout le nécessaire** pour installer, lancer et déployer ÉduPilot. Il est indépendant du reste du dépôt Arena : tu peux le copier tel quel sur ton mutualisé ou ton PC.

## Arborescence

```text
livrable-edupilot/
├── README.md              ← ce fichier
├── DEMARRAGE.md           ← commandes rapides
├── package.json           ← workspace pnpm (scripts racine)
├── pnpm-workspace.yaml
├── pnpm-lock.yaml
├── .gitignore / .dockerignore
├── docs/
│   └── DEPLOIEMENT.md     ← guide complet (mutualisé, systemd, Docker, sauvegardes)
├── edupilot-deploy.zip    ← archive identique, prête à télécharger
└── edupilot/              ← application Next.js 15
    ├── src/               ← pages, composants, actions, ML, schéma Drizzle
    ├── scripts/           ← seed et génération des icônes PWA
    ├── drizzle/           ← migrations SQLite
    ├── public/            ← icônes PWA + service worker
    ├── data/              ← data/edupilot.db créé au 1ᵉʳ lancement
    ├── uploads/           ← pièces jointes et photos HACCP
    ├── tests/ + playwright/
    ├── Dockerfile + docker-compose.yml
    └── .env.example
```

## Démarrage local

```bash
pnpm install && pnpm dev
# http://localhost:3000
```

Connexion : `directeur@fdf.edupilot.local` / `edupilot` (voir `DEMARRAGE.md`).

## Mutualisé

1. Copier ce dossier sur le serveur.
2. `cd edupilot && cp .env.example .env.local` puis renseigner `AUTH_SECRET` et `SEED_PASSWORD`.
3. `pnpm install --frozen-lockfile && pnpm build && pnpm start`.
4. Guide détaillé : [`docs/DEPLOIEMENT.md`](docs/DEPLOIEMENT.md).

Aucune base externe : tout est dans `edupilot/data/edupilot.db` + `edupilot/uploads/`.
