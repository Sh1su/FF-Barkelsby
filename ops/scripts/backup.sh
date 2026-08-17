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
