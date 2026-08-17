#!/bin/sh
# Erstellt .env, Caddyfile und docker-compose.yml im Repo-Root fuer den Produktions-Deploy.
#
# - app-Service wird ausschliesslich per "docker compose pull" aus der GitHub Container
#   Registry gezogen, nie lokal gebaut - das Image entsteht in der CI/CD-Pipeline
#   (.github/workflows/deploy.yml).
# - caddy-Service terminiert TLS und holt sich automatisch ein Let's-Encrypt-Zertifikat
#   fuer die angegebene Domain (Caddy: zero-config ACME, kein separates certbot noetig).
#   Nur eine Seite -> alles laeuft ueber Port 80 (ACME-Challenge + Redirect) und 443
#   (HTTPS); der app-Service selbst ist nach aussen NICHT mehr erreichbar, nur ueber
#   das interne Compose-Netzwerk als "app:3000".
#
# Voraussetzung: die Domain muss per DNS (A/AAAA) bereits auf diesen Server zeigen und
# Port 80+443 muessen aus dem Internet erreichbar sein - sonst schlaegt die
# Let's-Encrypt-Challenge fehl.
#
# Aufruf (im Repo-Root oder von hier aus):
#   ./ops/scripts/setup-deploy.sh --domain fortbildung.wehr.example
#   ./ops/scripts/setup-deploy.sh --domain fortbildung.wehr.example --image ghcr.io/sh1su/ff-barkelsby:sha-b384d55
#   ./ops/scripts/setup-deploy.sh --domain fortbildung.wehr.example --yes   # nicht-interaktiv, Rest generieren/leer lassen
#   ./ops/scripts/setup-deploy.sh --force                                   # vorhandene Dateien ueberschreiben
#
# Nicht-interaktiv laesst sich jeder Wert auch vorab exportieren, z. B.:
#   DOMAIN=fortbildung.wehr.example NUXT_ADMIN_EMAIL=wehrfuehrung@wehr.example \
#     ./ops/scripts/setup-deploy.sh --yes
set -eu

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
REPO_ROOT="$(CDPATH= cd -- "$SCRIPT_DIR/../.." && pwd)"
ENV_FILE="$REPO_ROOT/.env"
COMPOSE_FILE="$REPO_ROOT/docker-compose.yml"
CADDYFILE="$REPO_ROOT/Caddyfile"

DEFAULT_IMAGE="ghcr.io/sh1su/ff-barkelsby:sha-b384d55"
APP_IMAGE="${APP_IMAGE:-$DEFAULT_IMAGE}"
DOMAIN="${DOMAIN:-}"
FORCE=0
ASSUME_YES=0

log() { echo "==> $1"; }
err() { echo "Fehler: $1" >&2; exit 1; }

# -- Argumente ---------------------------------------------------------------------
while [ $# -gt 0 ]; do
  case "$1" in
    --domain|-d) DOMAIN="${2:?--domain braucht einen Wert}"; shift 2 ;;
    --image) APP_IMAGE="${2:?--image braucht einen Wert}"; shift 2 ;;
    --force) FORCE=1; shift ;;
    --yes|-y) ASSUME_YES=1; shift ;;
    --help|-h)
      sed -n '2,24p' "$0"
      exit 0
      ;;
    *) err "Unbekannte Option: $1 (siehe --help)" ;;
  esac
done

for f in "$ENV_FILE" "$COMPOSE_FILE" "$CADDYFILE"; do
  if [ -e "$f" ] && [ "$FORCE" -ne 1 ]; then
    err "$f existiert bereits. Mit --force überschreiben (vorher ggf. sichern!)."
  fi
done
[ "$FORCE" -eq 1 ] && log "Bestehende Dateien werden wegen --force überschrieben."

command -v openssl >/dev/null 2>&1 || err "openssl wird zum Erzeugen der Secrets benötigt, ist aber nicht installiert."

# -- Eingabehilfen ------------------------------------------------------------------
# Nutzt einen bereits exportierten Wert, wenn vorhanden; fragt sonst interaktiv
# (ausser bei --yes, dann bleibt der Default stehen).
ask() {
  var_name="$1"
  prompt="$2"
  default_value="$3"
  eval "current=\${$var_name:-}"

  if [ -n "$current" ]; then
    return 0
  fi
  if [ "$ASSUME_YES" -eq 1 ]; then
    eval "$var_name=\"\$default_value\""
    return 0
  fi

  if [ -n "$default_value" ]; then
    printf '%s [%s]: ' "$prompt" "$default_value" >&2
  else
    printf '%s: ' "$prompt" >&2
  fi
  read -r input
  if [ -z "$input" ]; then
    input="$default_value"
  fi
  eval "$var_name=\"\$input\""
}

gen_secret() {
  # 32+ Zeichen, ohne Zeilenumbruch/Sonderzeichen, die in .env Probleme machen.
  openssl rand -base64 "$1" | tr -d '\n=+/'
}

# -- Werte einsammeln -----------------------------------------------------------
ask DOMAIN "Domain (z. B. fortbildung.wehr.example, muss per DNS auf diesen Server zeigen)" ""
[ -n "$DOMAIN" ] || err "Domain ist erforderlich (--domain oder interaktiv angeben) - Let's Encrypt braucht eine echte, öffentlich auflösbare Domain."

: "${NUXT_SESSION_PASSWORD:=$(gen_secret 32)}"
: "${NUXT_ADMIN_PASSWORD:=$(gen_secret 18)}"
: "${NUXT_GUEST_PASSWORD:=$(gen_secret 18)}"

ask NUXT_ADMIN_EMAIL "E-Mail des Erst-Admins" "wehrfuehrung@wehr.example"
ask NUXT_GUEST_EMAIL "Kennung des Gast-Zugangs" "gast@wehr.example"
ask ACME_EMAIL "Kontakt-E-Mail für Let's Encrypt (Ablauf-/Widerrufshinweise)" "$NUXT_ADMIN_EMAIL"
ask NUXT_SMTP_HOST "SMTP-Host (leer = kein Mailversand)" ""
ask NUXT_SMTP_USER "SMTP-Benutzer" ""
ask NUXT_SMTP_PASSWORD "SMTP-Passwort" ""
ask BACKUP_AGE_RECIPIENT "age-Public-Key fürs Backup (leer = unverschlüsselt)" ""

NUXT_PUBLIC_APP_URL="https://$DOMAIN"

# -- .env schreiben ------------------------------------------------------------------
log "Schreibe $ENV_FILE"
cat > "$ENV_FILE" <<EOF
# Automatisch erzeugt von ops/scripts/setup-deploy.sh am $(date -Iseconds)
# NIEMALS committen - siehe .gitignore.

# Reverse Proxy / TLS (caddy-Service, automatisches Let's-Encrypt-Zertifikat)
DOMAIN=$DOMAIN
ACME_EMAIL=$ACME_EMAIL

# Pflicht (server/plugins/bootstrap.ts, FV-1). Ohne die vier NUXT_ADMIN_*/NUXT_GUEST_*
# Werte bricht das Seeding vor den Migrationen ab, siehe docs/docker-deployment.md.
NUXT_SESSION_PASSWORD=$NUXT_SESSION_PASSWORD
NUXT_ADMIN_EMAIL=$NUXT_ADMIN_EMAIL
NUXT_ADMIN_PASSWORD=$NUXT_ADMIN_PASSWORD
NUXT_GUEST_EMAIL=$NUXT_GUEST_EMAIL
NUXT_GUEST_PASSWORD=$NUXT_GUEST_PASSWORD

# Aus der Domain abgeleitet (https, da Caddy automatisch auf TLS umleitet).
NUXT_PUBLIC_APP_URL=$NUXT_PUBLIC_APP_URL

# Optional
NUXT_SMTP_HOST=$NUXT_SMTP_HOST
NUXT_SMTP_USER=$NUXT_SMTP_USER
NUXT_SMTP_PASSWORD=$NUXT_SMTP_PASSWORD
BACKUP_AGE_RECIPIENT=$BACKUP_AGE_RECIPIENT

# Welches Image "docker compose pull"/"up -d" fuer den app-Service zieht (ghcr.io).
# Zum Aktualisieren auf einen neuen Stand hier den Tag ändern, dann:
#   docker compose pull && docker compose up -d
APP_IMAGE=$APP_IMAGE
EOF
chmod 600 "$ENV_FILE"

# -- Caddyfile schreiben --------------------------------------------------------------
log "Schreibe $CADDYFILE"
cat > "$CADDYFILE" <<'EOF'
{
	email {$ACME_EMAIL}
}

{$DOMAIN} {
	encode gzip
	reverse_proxy app:3000
}
EOF

# -- docker-compose.yml schreiben ----------------------------------------------------
log "Schreibe $COMPOSE_FILE"
cat > "$COMPOSE_FILE" <<'EOF'
# Fortbildungsverwaltung - Produktions-Stack
# Erzeugt von ops/scripts/setup-deploy.sh.
#
# - app: wird ausschliesslich per "docker compose pull" aus der GitHub Container
#   Registry gezogen (gebaut in .github/workflows/deploy.yml), nie lokal gebaut, und
#   ist nach aussen nicht direkt erreichbar (kein "ports:", nur "expose:").
# - caddy: einziger nach aussen offener Dienst (80+443), terminiert TLS und holt sich
#   automatisch ein Let's-Encrypt-Zertifikat fuer ${DOMAIN} (siehe Caddyfile).
#
# Start:    docker compose pull && docker compose up -d
# Update:   docker compose pull && docker compose up -d   (Migrationen laufen automatisch)

services:
  app:
    image: ${APP_IMAGE}
    restart: unless-stopped
    expose:
      - "3000"
    environment:
      NUXT_SESSION_PASSWORD: ${NUXT_SESSION_PASSWORD:?bitte in .env setzen}
      # Pflicht fuer den Erst-Start (server/plugins/bootstrap.ts, FV-1): ohne diese vier
      # Werte bricht das Seeding vor den Migrationen ab - der Container laeuft zwar
      # weiter und /api/health meldet trotzdem "ok" (siehe Hinweis in
      # docs/docker-deployment.md), aber es existiert keine migrierte Datenbank.
      NUXT_ADMIN_EMAIL: ${NUXT_ADMIN_EMAIL:?bitte in .env setzen}
      NUXT_ADMIN_PASSWORD: ${NUXT_ADMIN_PASSWORD:?bitte in .env setzen}
      NUXT_GUEST_EMAIL: ${NUXT_GUEST_EMAIL:?bitte in .env setzen}
      NUXT_GUEST_PASSWORD: ${NUXT_GUEST_PASSWORD:?bitte in .env setzen}
      NUXT_DB_PATH: /data/app.db
      NUXT_UPLOAD_DIR: /data/uploads
      NUXT_BACKUP_MARKER: /backups/last-success   # /api/health meldet degraded, wenn zu alt
      NUXT_PUBLIC_APP_URL: ${NUXT_PUBLIC_APP_URL:?bitte in .env setzen}
      NUXT_SMTP_HOST: ${NUXT_SMTP_HOST:-}
      NUXT_SMTP_USER: ${NUXT_SMTP_USER:-}
      NUXT_SMTP_PASSWORD: ${NUXT_SMTP_PASSWORD:-}
      TZ: Europe/Berlin
    volumes:
      - app-data:/data
      - backups:/backups:ro      # nur lesend: die App meldet den Backup-Status, schreibt aber nicht
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://127.0.0.1:3000/api/health"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 20s
    logging:
      driver: json-file
      options: { max-size: "10m", max-file: "5" }

  # Einziger nach aussen offener Dienst: TLS-Terminierung + automatisches
  # Let's-Encrypt-Zertifikat fuer ${DOMAIN} (Caddyfile im Repo-Root). caddy-data
  # persistiert ACME-Account und Zertifikate - bei Verlust drohen Let's-Encrypt-
  # Rate-Limits durch wiederholte Neubeantragung, daher NIE dieses Volume loeschen.
  caddy:
    image: caddy:2-alpine
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    environment:
      DOMAIN: ${DOMAIN:?bitte in .env setzen}
      ACME_EMAIL: ${ACME_EMAIL:?bitte in .env setzen}
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy-data:/data
      - caddy-config:/config
    depends_on:
      app:
        condition: service_healthy
    logging:
      driver: json-file
      options: { max-size: "10m", max-file: "5" }

  # Ebene 1 der Backup-Strategie: taegliches Vollbackup 02:30 Uhr + GFS-Rotation.
  # Baut weiterhin lokal aus ./ops - dafuer muss dieses Repo (zumindest der ops/-Ordner)
  # auf dem Zielserver liegen, unabhaengig vom gepullten app-Image.
  backup:
    build:
      context: ./ops
      dockerfile: backup/Dockerfile
    image: fortbildungsverwaltung-backup:local
    restart: unless-stopped
    environment:
      DB_PATH: /data/app.db
      UPLOAD_DIR: /data/uploads
      BACKUP_DIR: /backups
      KEEP_DAILY: 7
      KEEP_WEEKLY: 4
      KEEP_MONTHLY: 6
      AGE_RECIPIENT: ${BACKUP_AGE_RECIPIENT:-}   # leer = unverschluesselt (nur lokal akzeptabel)
      TZ: Europe/Berlin
    volumes:
      - app-data:/data           # schreibend, damit pre-migration-Snapshots aufgeraeumt werden koennen
      - backups:/backups
    depends_on:
      app:
        condition: service_healthy
    logging:
      driver: json-file
      options: { max-size: "10m", max-file: "5" }

  # Ebene 2 (optional, empfohlen ab Produktivbetrieb): kontinuierliche WAL-Replikation.
  # Aktivieren mit:  docker compose --profile replication up -d
  litestream:
    image: litestream/litestream:0.3
    profiles: ["replication"]
    restart: unless-stopped
    command: replicate -config /etc/litestream.yml
    volumes:
      - app-data:/data
      - ./ops/litestream.yml:/etc/litestream.yml:ro
      - replica:/replica          # besser: NAS-Mount oder S3/MinIO ausserhalb des Hosts
    depends_on:
      app:
        condition: service_healthy

volumes:
  app-data:
  backups:
  replica:
  caddy-data:
  caddy-config:
EOF

log "Fertig."
echo ""
echo "Erzeugte Startpasswoerter (Wechsel wird beim ersten Anmelden erzwungen):"
echo "  Admin: $NUXT_ADMIN_EMAIL / $NUXT_ADMIN_PASSWORD"
echo "  Gast:  $NUXT_GUEST_EMAIL / $NUXT_GUEST_PASSWORD"
echo ""
echo "Domain: $DOMAIN   (Zertifikat wird beim ersten Start automatisch von Let's Encrypt geholt)"
echo "Image:  $APP_IMAGE"
echo ""
echo "Vor dem Start pruefen:"
echo "  - Zeigt die Domain per DNS (A/AAAA) bereits auf diesen Server?"
echo "  - Sind Port 80 und 443 aus dem Internet erreichbar (Firewall/Router)?"
echo ""
echo "Naechste Schritte:"
echo "  1. Falls das ghcr.io-Package privat ist, einmalig anmelden:"
echo "     echo \$GHCR_TOKEN | docker login ghcr.io -u <github-user> --password-stdin"
echo "  2. docker compose pull && docker compose up -d"
echo "  3. docker compose ps          # app und caddy muessen 'healthy'/'running' zeigen"
echo "  4. docker compose logs -f caddy   # bestaetigt den Let's-Encrypt-Bezug"
