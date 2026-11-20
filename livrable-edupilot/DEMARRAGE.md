# Démarrage rapide — ÉduPilot

## En local (une commande)

À la racine de CE dossier :

```bash
pnpm install && pnpm dev
```

Ouvre **http://localhost:3000**, puis connecte-toi avec :

- `directeur@fdf.edupilot.local` / `edupilot`
- ou un autre compte listé dans `edupilot/.env.example` et le README principal.

La base SQLite est créée automatiquement au premier accès.

## Sur ton mutualisé

```bash
cd edupilot
cp .env.example .env.local
# édite .env.local : AUTH_SECRET + SEED_PASSWORD obligatoires
pnpm install --frozen-lockfile
pnpm build
pnpm seed --force
pnpm start
```

Reverse-proxy HTTPS vers le port 3000. Guide complet : `docs/DEPLOIEMENT.md`.

## Docker (si autorisé)

```bash
cd edupilot
docker compose up -d --build
```

## Vérifications

```bash
pnpm test        # 11 tests Vitest
pnpm typecheck   # TypeScript strict
pnpm lint        # ESLint
pnpm build       # build de production
```
