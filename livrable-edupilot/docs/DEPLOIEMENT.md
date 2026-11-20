# Déployer ÉduPilot sur un hébergement mutualisé Node

ÉduPilot ne nécessite **ni base de données externe, ni service annexe** : un seul processus Node, un fichier SQLite et un dossier d’uploads. Il fonctionne donc chez tout hébergeur permettant un **processus Node.js persistent** (Plesk/cPanel avec Node, VPS mutualisé, centre de gestion, Docker). Il ne peut pas tourner sur un hébergement PHP/statique pur.

## 1. Prérequis côté hébergeur

- Node.js **20 ou plus** (22 recommandé), pnpm (ou `corepack enable`), accès SSH.
- Droits d’écriture sur `data/` et `uploads/`.
- Possibilité de lancer et maintenir un processus (`systemd`, PM2, ou le gestionnaire d’applications Node de l’hébergeur).
- Le reverse-proxy HTTPS de l’hébergeur pointe vers `127.0.0.1:3000` (ou le port choisi).

## 2. Récupérer le code

```bash
git clone <URL-DU-DEPOT> edupilot-host
cd edupilot-host
git checkout arena/5b51705a-model-arena
```

Le dossier `edupilot/` est autonome ; les fichiers à la racine (`package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`) servent aux scripts du workspace. Copie le dépôt complet pour simplifier.

## 3. Configuration

```bash
cd edupilot
cp .env.example .env.local
```

Édite `.env.local` :

```env
AUTH_SECRET=une-chaine-aleatoire-d-au-moins-32-caracteres
SEED_PASSWORD=un-mot-de-passe-solide-pour-les-comptes-de-demo
PORT=3000
```

> ⚠️ Le mot de passe par défaut du jeu de démonstration est `edupilot`. Sur un serveur accessible publiquement, **définis `SEED_PASSWORD` avant le premier lancement**, puis régénère les données avec `pnpm seed --force`. Tu peux aussi, après connexion, désactiver les comptes de démo dans **Administration → Utilisateurs** et créer tes propres comptes.

## 4. Installation et build

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm seed --force
```

Le seed est idempotent : `pnpm seed` seul ne touche à rien si la base existe déjà. Tu peux même omettre cette étape : la base est créée automatiquement au premier accès.

## 5. Lancer le processus

### Avec le gestionnaire Node de l’hébergeur

- Commande de démarrage : `pnpm start`
- Répertoire de départ : `/chemin/vers/edupilot`
- Port : `3000`
- Variables d’environnement : celles de `.env.local`

### Avec systemd (VPS / centre de gestion)

Crée `/etc/systemd/system/edupilot.service` :

```ini
[Unit]
Description=ÉduPilot
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/srv/edupilot
Environment=NODE_ENV=production
EnvironmentFile=/srv/edupilot/.env.local
ExecStart=/usr/local/bin/pnpm start
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Puis :

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now edupilot
sudo systemctl status edupilot
```

### Avec Docker (si l’hébergeur accepte les conteneurs)

```bash
cd edupilot
docker compose up -d --build
```

Le `docker-compose.yml` ne déclare que l’application, avec deux volumes locaux : `data/` (SQLite) et `uploads/`.

## 6. Sauvegardes

La base est en mode WAL : pour une copie cohérente, arrête l’application puis archive **les trois fichiers** :

```bash
systemctl stop edupilot
tar czf backup-edupilot-$(date +%F).tar.gz data/uploads data/edupilot.db data/edupilot.db-wal data/edupilot.db-shm uploads/
systemctl start edupilot
```

Ou utilise l’outil de backup de l’hébergeur sur tout le dossier `edupilot/`.

## 7. Mises à jour

```bash
git pull
pnpm install --frozen-lockfile
pnpm build
systemctl restart edupilot
```

La base `data/edupilot.db` n’est pas écrasée par une mise à jour : les données métier sont conservées. Les migrations Drizzle sont appliquées automatiquement au démarrage.

## 8. Vérification rapide

```bash
curl -I http://127.0.0.1:3000/login      # doit répondre 200
curl http://127.0.0.1:3000/manifest.webmanifest
```

Depuis le navigateur : connexion avec un compte créé ou régénéré, puis **Tableau de bord → IA Restauration → Adjust & Valider**. Le journal d’audit doit afficher la suggestion IA et ta décision.

## Points d’attention

- Ne place pas le dépôt sous un sous-chemin URL (`/edupilot/`) sans configurer `basePath` dans `next.config.ts`.
- Le reverse-proxy doit transmettre les en-têtes `Host` et `X-Forwarded-*` (NextAuth est configuré avec `trustHost: true`).
- Si l’hébergeur limite la mémoire, prévois au moins 512 Mo pour le build Next.js.
- Aucune donnée ne sort : tu peux couper tout accès Internet sortant du processus après l’installation des dépendances.
