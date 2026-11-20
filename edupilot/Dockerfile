# Un seul conteneur, un seul processus Node, une base SQLite locale.
FROM node:22-slim

WORKDIR /app
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates python3 make g++ \
 && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@10.15.0 --activate

# Installation depuis la racine du workspace pnpm.
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY edupilot/package.json ./edupilot/package.json
RUN pnpm install --frozen-lockfile

COPY edupilot ./edupilot
WORKDIR /app/edupilot
RUN mkdir -p data uploads/aides uploads/haccp \
 && pnpm build

ENV NODE_ENV=production \
    HOSTNAME=0.0.0.0 \
    PORT=3000

VOLUME ["/app/edupilot/data", "/app/edupilot/uploads"]
EXPOSE 3000

# Le seed est idempotent : il ne remplit la base que si elle est vide.
CMD ["sh", "-c", "pnpm seed && pnpm start"]
