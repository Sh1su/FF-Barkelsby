# Docker Deployment

Die Fortbildungsverwaltung wird als einzelnes Container-Image ausgeliefert. Zustand (SQLite-Datei und
hochgeladene Nachweise) liegt ausschließlich auf einem Volume – das Image selbst ist austauschbar.

## Build-Grundlagen
`nuxt build` erzeugt `.output/` mit einem eigenständigen Node-Server (`.output/server/index.mjs`).
Nur dieses Verzeichnis wird ins finale Image kopiert.

## Dockerfile (Multi-Stage)

```dockerfile
# syntax=docker/dockerfile:1

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

# better-sqlite3 ist ein natives Modul: Prebuild wird aus dem Build-Stage übernommen
COPY --from=build /app/.output ./.output
COPY --from=build /app/node_modules/better-sqlite3 ./node_modules/better-sqlite3
COPY --from=build /app/server/database/migrations ./migrations

RUN apk add --no-cache sqlite tini \
 && mkdir -p /data/uploads \
 && chown -R node:node /data /app

USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", ".output/server/index.mjs"]
```

Hinweis zu `better-sqlite3`: das Modul wird beim Install für die Zielplattform kompiliert. Build- und
Runtime-Image müssen daher dieselbe Basis (hier `node:22-alpine`) und Architektur verwenden. Alternativ
`@libsql/client` verwenden, das ohne nativen Build-Schritt auskommt.

## `.dockerignore`

```
node_modules
.nuxt
.output
.git
.env
.env.*
!.env.example
data
*.db
*.db-wal
*.db-shm
tests
coverage
features
docs
```

## docker-compose.yml

Die vollständige Datei inklusive Backup-Service und optionaler Litestream-Replikation liegt unter
`ops/docker-compose.yml`. Verkürzte Fassung ohne Backup:

```yaml
services:
  app:
    build: .
    image: fortbildungsverwaltung:latest
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      NUXT_SESSION_PASSWORD: ${NUXT_SESSION_PASSWORD:?bitte in .env setzen}
      NUXT_DATABASE_PATH: /data/app.db
      NUXT_UPLOAD_DIR: /data/uploads
      NUXT_PUBLIC_APP_URL: ${NUXT_PUBLIC_APP_URL:-http://localhost:3000}
      NUXT_SMTP_HOST: ${NUXT_SMTP_HOST:-}
      NUXT_SMTP_USER: ${NUXT_SMTP_USER:-}
      NUXT_SMTP_PASSWORD: ${NUXT_SMTP_PASSWORD:-}
      TZ: Europe/Berlin
    volumes:
      - app-data:/data
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://127.0.0.1:3000/api/health"]
      interval: 30s
      timeout: 5s
      retries: 3
    logging:
      driver: json-file
      options:
        max-size: "10m"
        max-file: "5"

volumes:
  app-data:
```

## Migrationen beim Start

Migrationen laufen automatisch, bevor der Server Requests annimmt:

```ts
// server/plugins/migrate.ts
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { db } from '../utils/db'

export default defineNitroPlugin(() => {
  migrate(db, { migrationsFolder: './migrations' })
  console.log(JSON.stringify({ level: 'info', message: 'Migrationen angewendet' }))
})
```

Schlägt eine Migration fehl, muss der Start abbrechen – ein laufender Container mit halb migrierter
Datenbank ist gefährlicher als ein Neustart-Loop.

## Erster Start

```bash
# 1. Session-Secret erzeugen (min. 32 Zeichen)
echo "NUXT_SESSION_PASSWORD=$(openssl rand -base64 32)" >> .env

# 2. Starten
docker compose up -d --build

# 3. Logs prüfen
docker compose logs -f app

# 4. Admin-Benutzer anlegen (idempotenter Seed)
docker compose exec app node .output/server/index.mjs --seed
#    alternativ: dedizierter One-Shot-Service im Compose
```

## Zugangsdaten im Betrieb ändern (FV-12)

Der Regelweg ist die Oberfläche: `/verwaltung` → Tab **Benutzerverwaltung** (FV-7). Das setzt
voraus, dass man sich noch anmelden kann. Für den Störungsfall – Admin-Passwort vergessen, Kennung
vertippt – gibt es die Konto-CLI. Sie arbeitet direkt auf der SQLite-Datei und braucht keine
laufende Anwendung.

```bash
npm run user -- list                                   # welche Konten gibt es?
npm run user -- set-email    guest gast@wehr.example   # Kennung ändern
npm run user -- set-password admin                     # Passwort verdeckt abfragen
npm run user -- set-password admin --wechsel-erzwingen # Wechsel beim nächsten Anmelden erzwingen
```

`<konto>` ist eine Kennung, `guest` oder `admin`; die Kurzform `admin` bricht mit einer Auflistung
ab, sobald es mehrere Verwaltungskonten gibt. Die Datenbank kommt aus `NUXT_DB_PATH`.

Im Container gibt es das Skript bislang **nicht** – es braucht `tsx`, und das Produktionsimage
enthält nur `.output` und die Laufzeitabhängigkeiten. Wie die CLI ins Image kommt (eigener
One-Shot-Service oder mitgebündeltes Skript), entscheidet FV-9 zusammen mit dem Dockerfile. Bis
dahin läuft sie vom Host aus gegen die Datei im Volume:

```bash
NUXT_DB_PATH=/pfad/zum/volume/app.db npm run user -- list
```

Zwei Dinge sind bewusst so:

- **Das Passwort wird nie als Argument entgegengenommen** – es stünde sonst in der Shell-Historie
  und in der Prozessliste. Für Skripte gibt es
  `echo "…" | npm run user -- set-password guest --passwort-stdin`.
- **Ein Passwortwechsel beendet keine laufenden Sitzungen** (gleiche Entscheidung wie in FV-7:
  sonst fliegt die halbe Wehr mitten in der Woche raus). Wer eine Sitzung wirklich beenden will,
  deaktiviert das Konto in der Oberfläche.

Wer Dateizugriff auf `app.db` hat, kann damit jedes Konto übernehmen. Das gilt für die Datei
ohnehin – der Zugriff auf das Volume ist die eigentliche Schutzgrenze, nicht die CLI.

## Umgebungsvariablen

| Variable | Pflicht | Beschreibung |
|----------|---------|--------------|
| `NUXT_SESSION_PASSWORD` | ja | Secret zum Versiegeln des Session-Cookies, min. 32 Zeichen |
| `NUXT_DATABASE_PATH` | ja | Pfad zur SQLite-Datei, muss im Volume liegen (`/data/app.db`) |
| `NUXT_UPLOAD_DIR` | ja | Verzeichnis für Nachweise (`/data/uploads`) |
| `NUXT_PUBLIC_APP_URL` | ja | Öffentliche Basis-URL (für Links in E-Mails) |
| `NUXT_SMTP_*` | nein | SMTP-Zugang für Benachrichtigungen (FV-8) |
| `NUXT_PUBLIC_SENTRY_DSN` | nein | Error-Tracking (siehe `docs/error-tracking.md`) |
| `TZ` | empfohlen | Zeitzone des Containers, `Europe/Berlin` |

Jede neue Variable gehört in `.env.example` **und** in diese Tabelle.

## Reverse Proxy & TLS

Der Container spricht HTTP. TLS terminiert davor, z. B. mit Caddy:

```
fortbildung.intern.example.org {
    reverse_proxy app:3000
}
```

Der Proxy muss `X-Forwarded-For` und `X-Forwarded-Proto` setzen (wichtig für Rate Limiting und
sichere Cookies) und vom Client mitgeschickte Werte überschreiben.

## Backup & Restore

Backups laufen automatisch über den `backup`-Service im Compose-Stack (täglich 02:30 Uhr,
GFS-Rotation, Integritätsprüfung, optionale Verschlüsselung). Die vollständige Strategie inklusive
RPO/RTO-Zielen, Litestream-Replikation und Restore-Übungen steht in `docs/backup-strategy.md`.

```bash
# Backup sofort auslösen (statt auf den Cron zu warten)
docker compose exec backup /scripts/backup.sh

# Vorhandene Backups auflisten
docker compose exec backup ls -lh /backups/daily /backups/weekly /backups/monthly

# Restore (App vorher stoppen!)
docker compose stop app
docker compose run --rm backup /scripts/restore.sh /backups/daily/fv-backup-2026-08-10T02-30.tar.gz
docker compose up -d app
```

Die App selbst legt zusätzlich vor jeder Datenbank-Migration automatisch einen Snapshot unter
`/data/pre-migration/` an – das ist die Rückfalloption bei einem fehlgeschlagenen Deployment.

`/api/health` meldet `degraded`, wenn der letzte erfolgreiche Backup-Lauf älter als 26 Stunden ist.

## Update-Ablauf

```bash
git pull
docker compose build
docker compose up -d          # Migrationen laufen beim Start automatisch
docker compose ps             # Healthcheck muss "healthy" zeigen
```

Vor jedem Update: Backup ziehen (`docker compose exec backup /scripts/backup.sh`). Bei destruktiven Migrationen zusätzlich vorher freigeben lassen
(siehe `.claude/rules/database.md`).

## Grenzen dieses Setups
- **Eine Instanz:** SQLite erlaubt keinen Multi-Node-Betrieb. Kein `deploy.replicas > 1`,
  keine Volume-Freigabe über NFS/SMB (WAL-Modus funktioniert dort nicht zuverlässig)
- Neustart bedeutet kurze Nichtverfügbarkeit – für interne Anwendungen in der Regel akzeptabel
- Bei Bedarf später: Wechsel auf LiteFS/Turso oder PostgreSQL – Drizzle macht den Umzug überschaubar,
  deshalb keine SQLite-spezifischen Konstrukte über die `server/database/`-Schicht hinaus verwenden
