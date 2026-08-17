# syntax=docker/dockerfile:1
#
# Multi-Stage-Build wie in docs/docker-deployment.md beschrieben. Nur .output/ (der
# eigenständige Nitro-Server) landet im finalen Image, nicht der Quellcode oder
# node_modules aus dem Build-Stage.

FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    NITRO_PORT=3000 \
    NITRO_HOST=0.0.0.0 \
    NUXT_DATABASE_PATH=/data/app.db \
    NUXT_UPLOAD_DIR=/data/uploads

# better-sqlite3 ist ein natives Modul: Prebuild wird aus dem Build-Stage übernommen,
# statt es im Runtime-Image neu zu kompilieren.
COPY --from=build /app/.output ./.output
COPY --from=build /app/node_modules/better-sqlite3 ./node_modules/better-sqlite3
COPY --from=build /app/server/database/migrations ./migrations

RUN apk add --no-cache sqlite tini \
 && mkdir -p /data/uploads \
 && chown -R node:node /data /app

USER node
EXPOSE 3000

# Container-eigener Funktionstest: Docker/Compose/Orchestrator markiert den Container
# erst als "healthy", wenn /api/health erfolgreich antwortet (server/api/health.get.ts).
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", ".output/server/index.mjs"]
