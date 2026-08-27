#!/bin/sh
# Eigenstaendiges Setup-Script fuer den Produktions-Deploy - braucht NUR diese eine
# Datei. Kopieren, in einen leeren Ordner auf dem Zielserver legen, ausfuehren: erzeugt
# dort .env, Caddyfile, docker-compose.yml UND den kompletten ops/-Unterordner
# (Backup-Sidecar + Litestream-Konfig), die docker-compose.yml sonst braucht. Kein
# Checkout des Haupt-Repos auf dem Server noetig.
#
# - app-Service wird ausschliesslich per "docker compose pull" aus der GitHub Container
#   Registry gezogen, nie lokal gebaut - das Image entsteht in der CI/CD-Pipeline
#   (.github/workflows/deploy.yml).
# - caddy-Service terminiert TLS und holt sich automatisch ein Let's-Encrypt-Zertifikat
#   fuer die angegebene Domain (Caddy: zero-config ACME, kein separates certbot noetig).
#   Nur eine Seite -> alles laeuft ueber Port 80 (ACME-Challenge + Redirect) und 443
#   (HTTPS); der app-Service selbst ist nach aussen NICHT mehr erreichbar, nur ueber
#   das interne Compose-Netzwerk als "app:3000".
# - backup/litestream bauen lokal aus dem mit erzeugten ops/-Ordner (kein Registry-Image
#   dafuer) - deshalb bringt dieses Script sie als eingebettete Dateien mit.
#
# Voraussetzung: die Domain muss per DNS (A/AAAA) bereits auf diesen Server zeigen und
# Port 80+443 muessen aus dem Internet erreichbar sein - sonst schlaegt die
# Let's-Encrypt-Challenge fehl.
#
# Aufruf:
#   ./setup-deploy.sh --domain fortbildung.wehr.example
#   ./setup-deploy.sh --domain fortbildung.wehr.example --image ghcr.io/sh1su/ff-barkelsby:sha-b384d55
#   ./setup-deploy.sh --domain fortbildung.wehr.example --dir /opt/fireedu
#   ./setup-deploy.sh --domain fortbildung.wehr.example --yes    # nicht-interaktiv, Rest generieren/leer lassen
#   ./setup-deploy.sh --force                                     # vorhandene Dateien überschreiben
#
# Nicht-interaktiv laesst sich jeder Wert auch vorab exportieren, z. B.:
#   DOMAIN=fortbildung.wehr.example NUXT_ADMIN_EMAIL=wehrfuehrung@wehr.example \
#     ./setup-deploy.sh --yes
set -eu

TARGET_DIR="$(pwd)"
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
    --dir) TARGET_DIR="${2:?--dir braucht einen Wert}"; shift 2 ;;
    --force) FORCE=1; shift ;;
    --yes|-y) ASSUME_YES=1; shift ;;
    --help|-h)
      sed -n '2,27p' "$0"
      exit 0
      ;;
    *) err "Unbekannte Option: $1 (siehe --help)" ;;
  esac
done

mkdir -p "$TARGET_DIR/ops/backup" "$TARGET_DIR/ops/scripts"
TARGET_DIR="$(CDPATH= cd -- "$TARGET_DIR" && pwd)"

ENV_FILE="$TARGET_DIR/.env"
COMPOSE_FILE="$TARGET_DIR/docker-compose.yml"
CADDYFILE="$TARGET_DIR/Caddyfile"
BACKUP_DOCKERFILE="$TARGET_DIR/ops/backup/Dockerfile"
LITESTREAM_YML="$TARGET_DIR/ops/litestream.yml"
BACKUP_SH="$TARGET_DIR/ops/scripts/backup.sh"
RESTORE_SH="$TARGET_DIR/ops/scripts/restore.sh"

for f in "$ENV_FILE" "$COMPOSE_FILE" "$CADDYFILE" "$BACKUP_DOCKERFILE" "$LITESTREAM_YML" "$BACKUP_SH" "$RESTORE_SH"; do
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
# Automatisch erzeugt von setup-deploy.sh am $(date -Iseconds)
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

# -- ops/backup/Dockerfile schreiben (Backup-Sidecar, baut lokal) --------------------
log "Schreibe $BACKUP_DOCKERFILE"
cat > "$BACKUP_DOCKERFILE" <<'EOF'
# Backup-Sidecar: teilt sich das Daten-Volume mit der App und laeuft per Cron.
FROM alpine:3.20

RUN apk add --no-cache sqlite tzdata age tini
ENV TZ=Europe/Berlin

COPY scripts/backup.sh /scripts/backup.sh
COPY scripts/restore.sh /scripts/restore.sh
RUN chmod +x /scripts/*.sh

# Taeglich 02:30 Uhr, Ausgabe in das Container-Log
RUN echo '30 2 * * * /scripts/backup.sh >> /proc/1/fd/1 2>&1' > /etc/crontabs/root

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["crond", "-f", "-l", "8"]
EOF

# -- ops/scripts/backup.sh schreiben ---------------------------------------------------
log "Schreibe $BACKUP_SH"
cat > "$BACKUP_SH" <<'EOF'
#!/bin/sh
# Tägliches Backup der Fortbildungsverwaltung: SQLite-Datenbank + hochgeladene Nachweise.
# Läuft im backup-Container, der /data (read-only) und /backups gemountet hat.
set -eu

DB_PATH="${DB_PATH:-/data/app.db}"
UPLOAD_DIR="${UPLOAD_DIR:-/data/uploads}"
BACKUP_DIR="${BACKUP_DIR:-/backups}"
KEEP_DAILY="${KEEP_DAILY:-7}"
KEEP_WEEKLY="${KEEP_WEEKLY:-4}"
KEEP_MONTHLY="${KEEP_MONTHLY:-6}"
AGE_RECIPIENT="${AGE_RECIPIENT:-}"   # optional: age-Public-Key -> Archiv wird verschlüsselt

STAMP="$(date +%FT%H-%M)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

log() { echo "{\"level\":\"$1\",\"time\":\"$(date -Iseconds)\",\"component\":\"backup\",\"message\":\"$2\"}"; }

log info "Backup gestartet"

# 1. Konsistente Kopie der Datenbank (NIE einfach cp - WAL!)
sqlite3 "$DB_PATH" "VACUUM INTO '$TMP/app.db'"

# 2. Integritätsprüfung auf der Kopie
RESULT="$(sqlite3 "$TMP/app.db" 'PRAGMA integrity_check;')"
if [ "$RESULT" != "ok" ]; then
  log error "Integritaetspruefung fehlgeschlagen: $RESULT"
  exit 1
fi

# 3. Uploads dazu
if [ -d "$UPLOAD_DIR" ]; then
  tar cf "$TMP/uploads.tar" -C "$(dirname "$UPLOAD_DIR")" "$(basename "$UPLOAD_DIR")"
else
  log warn "Upload-Verzeichnis nicht gefunden, sichere nur die Datenbank"
  : > "$TMP/uploads.tar"
fi

# 4. Ein Archiv aus beidem
ARCHIVE="$BACKUP_DIR/daily/fv-backup-$STAMP.tar.gz"
mkdir -p "$BACKUP_DIR/daily" "$BACKUP_DIR/weekly" "$BACKUP_DIR/monthly"
tar czf "$ARCHIVE" -C "$TMP" app.db uploads.tar

# 5. Optional verschluesseln (personenbezogene Daten!)
if [ -n "$AGE_RECIPIENT" ]; then
  age -r "$AGE_RECIPIENT" -o "$ARCHIVE.age" "$ARCHIVE"
  rm -f "$ARCHIVE"
  ARCHIVE="$ARCHIVE.age"
fi

sha256sum "$ARCHIVE" > "$ARCHIVE.sha256"

# 6. Wochen-/Monatskopie (GFS-Rotation)
[ "$(date +%u)" = "7" ] && cp "$ARCHIVE" "$BACKUP_DIR/weekly/" || true
[ "$(date +%d)" = "01" ] && cp "$ARCHIVE" "$BACKUP_DIR/monthly/" || true

# 7. Alte Backups aufraeumen
find "$BACKUP_DIR/daily"   -name 'fv-backup-*' -mtime "+$KEEP_DAILY"           -delete
find "$BACKUP_DIR/weekly"  -name 'fv-backup-*' -mtime "+$((KEEP_WEEKLY * 7))"  -delete
find "$BACKUP_DIR/monthly" -name 'fv-backup-*' -mtime "+$((KEEP_MONTHLY * 31))" -delete
find /data/pre-migration -name 'app-*.db' -mtime +14 -delete 2>/dev/null || true

# 8. Erfolgsmarker fuer das Monitoring (/api/health prueft diesen Zeitstempel)
date -Iseconds > "$BACKUP_DIR/last-success"

log info "Backup erfolgreich: $(basename "$ARCHIVE") ($(du -h "$ARCHIVE" | cut -f1))"
EOF
chmod +x "$BACKUP_SH"

# -- ops/scripts/restore.sh schreiben --------------------------------------------------
log "Schreibe $RESTORE_SH"
cat > "$RESTORE_SH" <<'EOF'
#!/bin/sh
# Restore der Fortbildungsverwaltung aus einem Backup-Archiv.
# WICHTIG: Die App muss vorher gestoppt sein  ->  docker compose stop app
set -eu

ARCHIVE="${1:-}"
DATA_DIR="${DATA_DIR:-/data}"
BACKUP_DIR="${BACKUP_DIR:-/backups}"

if [ -z "$ARCHIVE" ] || [ ! -f "$ARCHIVE" ]; then
  echo "Verwendung: restore.sh /backups/daily/fv-backup-<stamp>.tar.gz[.age]"
  echo "Verfuegbare Backups:"
  ls -1 "$BACKUP_DIR"/daily "$BACKUP_DIR"/weekly "$BACKUP_DIR"/monthly 2>/dev/null || true
  exit 1
fi

echo "!! Der aktuelle Datenbestand in $DATA_DIR wird ueberschrieben."
echo "!! Stelle sicher, dass der app-Container gestoppt ist (docker compose stop app)."
printf "Zum Fortfahren 'RESTORE' eingeben: "
read -r CONFIRM
[ "$CONFIRM" = "RESTORE" ] || { echo "Abgebrochen."; exit 1; }

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# 1. Sicherheitskopie des aktuellen Zustands
PRE="$BACKUP_DIR/pre-restore-$(date +%FT%H-%M).tar.gz"
tar czf "$PRE" -C "$DATA_DIR" . 2>/dev/null || true
echo "Aktueller Zustand gesichert unter: $PRE"

# 2. Archiv entpacken (ggf. entschluesseln)
case "$ARCHIVE" in
  *.age) age -d -i /keys/backup.key -o "$TMP/archive.tar.gz" "$ARCHIVE" ;;
  *)     cp "$ARCHIVE" "$TMP/archive.tar.gz" ;;
esac
tar xzf "$TMP/archive.tar.gz" -C "$TMP"

# 3. Integritaet des Backups pruefen, BEVOR etwas ueberschrieben wird
RESULT="$(sqlite3 "$TMP/app.db" 'PRAGMA integrity_check;')"
[ "$RESULT" = "ok" ] || { echo "Backup ist beschaedigt: $RESULT"; exit 1; }

# 4. Zurueckspielen
rm -f "$DATA_DIR/app.db" "$DATA_DIR/app.db-wal" "$DATA_DIR/app.db-shm"
cp "$TMP/app.db" "$DATA_DIR/app.db"
rm -rf "$DATA_DIR/uploads"
tar xf "$TMP/uploads.tar" -C "$DATA_DIR"

echo "Restore abgeschlossen. Jetzt starten:  docker compose up -d app"
EOF
chmod +x "$RESTORE_SH"

# -- ops/litestream.yml schreiben (optional, Profil "replication") --------------------
log "Schreibe $LITESTREAM_YML"
cat > "$LITESTREAM_YML" <<'EOF'
# Kontinuierliche Replikation der SQLite-Datenbank (RPO ~10 Sekunden).
# Voraussetzung: die App laeuft im WAL-Modus (siehe .claude/rules/database.md).
dbs:
  - path: /data/app.db
    replicas:
      # Lokales Ziel - fuer echten Schutz auf ein zweites System zeigen lassen (NAS/S3/MinIO).
      - type: file
        path: /replica/app.db
        retention: 168h          # 7 Tage Point-in-Time-Restore
        sync-interval: 10s
        snapshot-interval: 24h

# Restore auf einen Zeitpunkt:
#   litestream restore -config /etc/litestream.yml \
#     -timestamp 2026-08-10T14:00:00Z -o /data/app.db /data/app.db
EOF

# -- docker-compose.yml schreiben ----------------------------------------------------
log "Schreibe $COMPOSE_FILE"
cat > "$COMPOSE_FILE" <<'EOF'
# Fortbildungsverwaltung - Produktions-Stack
# Erzeugt von setup-deploy.sh.
#
# - app: wird ausschliesslich per "docker compose pull" aus der GitHub Container
#   Registry gezogen (gebaut in .github/workflows/deploy.yml), nie lokal gebaut, und
#   ist nach aussen nicht direkt erreichbar (kein "ports:", nur "expose:").
# - caddy: einziger nach aussen offener Dienst (80+443), terminiert TLS und holt sich
#   automatisch ein Let's-Encrypt-Zertifikat fuer ${DOMAIN} (siehe Caddyfile).
# - backup/litestream: bauen lokal aus dem danebenliegenden ops/-Ordner (von diesem
#   Script mit erzeugt) - kein Registry-Image dafuer noetig.
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
  # Let's-Encrypt-Zertifikat fuer ${DOMAIN} (Caddyfile daneben). caddy-data
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
  # Baut lokal aus ./ops (von diesem Script mit erzeugt) - kein Registry-Image dafuer.
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
echo "Verzeichnis: $TARGET_DIR"
find "$TARGET_DIR" -maxdepth 3 \( -path "*/ops/*" -o -name "*.env" -o -name "Caddyfile" -o -name "docker-compose.yml" \) | sed "s|^$TARGET_DIR|  .|"
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
echo "  cd $TARGET_DIR"
echo "  1. Falls das ghcr.io-Package privat ist, einmalig anmelden:"
echo "     echo \$GHCR_TOKEN | docker login ghcr.io -u <github-user> --password-stdin"
echo "  2. docker compose pull && docker compose up -d"
echo "  3. docker compose ps          # app und caddy muessen 'healthy'/'running' zeigen"
echo "  4. docker compose logs -f caddy   # bestaetigt den Let's-Encrypt-Bezug"
