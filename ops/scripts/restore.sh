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
