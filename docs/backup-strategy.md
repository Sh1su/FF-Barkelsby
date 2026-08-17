# Backup-Strategie (SQLite + Uploads)

Der gesamte Zustand der Anwendung liegt in zwei Artefakten auf dem Docker-Volume:

| Artefakt | Pfad | Inhalt |
|----------|------|--------|
| Datenbank | `/data/app.db` (+ `-wal`, `-shm`) | Benutzer, Fortbildungen, Anträge, Punkte, Audit-Log |
| Nachweise | `/data/uploads/` | hochgeladene Zertifikate (PDF/JPG/PNG) |

Beides muss gemeinsam und konsistent gesichert werden – eine Datenbank ohne die zugehörigen
Zertifikatsdateien ist für ein Audit wertlos.

## Schutzziele

| Kennzahl | Ziel | Begründung |
|----------|------|-----------|
| **RPO** (max. Datenverlust) | 24 h Basis, 5 min mit Replikation | Anträge und Nachweise sind rekonstruierbar, aber aufwendig |
| **RTO** (max. Ausfallzeit) | 1 Stunde | interne Anwendung, kein 24/7-Betrieb nötig |
| **Aufbewahrung** | 7 täglich / 4 wöchentlich / 6 monatlich | deckt späte Fehlerentdeckung ab |
| **Restore-Test** | 1× pro Quartal | ein ungetestetes Backup ist kein Backup |

## Die goldene Regel

**Die SQLite-Datei niemals im laufenden Betrieb einfach kopieren** (`cp`, `tar`, Volume-Snapshot).
Im WAL-Modus liegen Transaktionen in `app.db-wal`; eine reine Dateikopie kann inkonsistent oder
korrupt sein. Immer eine der beiden sicheren Methoden verwenden:

```bash
sqlite3 /data/app.db "VACUUM INTO '/backups/app-2026-08-10.db'"   # konsistent + defragmentiert
sqlite3 /data/app.db ".backup '/backups/app-2026-08-10.db'"        # konsistent, Online-Backup-API
```

## Ebene 1 – Tägliches Vollbackup (Pflicht)

Ein eigener `backup`-Service im Compose-Stack teilt sich das Daten-Volume mit der App und läuft
per Cron. Ablauf pro Lauf (`ops/scripts/backup.sh`):

1. `VACUUM INTO` in eine temporäre Datei
2. `PRAGMA integrity_check` auf der **Kopie** – schlägt sie fehl, bricht der Lauf mit Fehler ab
3. Uploads als Tar dazu packen, beides in ein Archiv `fv-backup-<timestamp>.tar.gz`
4. Optional verschlüsseln (`age`), Prüfsumme schreiben
5. Rotation nach dem GFS-Schema (7 täglich / 4 wöchentlich / 6 monatlich)
6. Zeitstempel nach `/backups/last-success` schreiben (für Monitoring)

Zeitpunkt: nachts, z. B. 02:30 Uhr `Europe/Berlin`.

## Ebene 2 – Kontinuierliche Replikation (empfohlen ab Produktivbetrieb)

[Litestream](https://litestream.io) repliziert den WAL-Strom fortlaufend auf ein zweites Ziel
(S3, MinIO, oder ein gemountetes NAS-Verzeichnis). Damit sinkt der RPO von 24 Stunden auf Sekunden,
und ein Point-in-Time-Restore wird möglich.

```yaml
# ops/litestream.yml
dbs:
  - path: /data/app.db
    replicas:
      - type: file
        path: /replica/app.db
        retention: 168h          # 7 Tage Point-in-Time
        sync-interval: 10s
```

Litestream läuft als eigener Container am selben Volume. Wichtig: nur **eine** Instanz darf
replizieren, und die App muss im WAL-Modus laufen (tut sie, siehe `.claude/rules/database.md`).

## Ebene 3 – Auslagerung außer Haus

Backups auf demselben Host schützen nicht gegen Hardwareausfall, Ransomware oder versehentliches
`docker volume rm`. Mindestens die wöchentlichen Archive auf ein zweites System kopieren
(NAS, Bandlaufwerk, verschlüsselter Objektspeicher). Das Zielsystem darf keine Löschrechte auf die
Quelle haben (Pull statt Push, oder Write-Once-Ablage).

## Automatisches Backup vor jeder Migration

Der gefährlichste Moment ist ein Deployment mit destruktiver Migration. Deshalb sichert die
Anwendung selbst, bevor sie Migrationen anwendet:

```ts
// server/plugins/migrate.ts (Auszug)
export default defineNitroPlugin(() => {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  db.run(sql`VACUUM INTO ${`/data/pre-migration/app-${stamp}.db`}`)
  migrate(db, { migrationsFolder: './migrations' })
})
```

Diese Pre-Migration-Snapshots werden nach 14 Tagen automatisch aufgeräumt. Schlägt eine Migration
fehl, ist der Zustand von vor dem Deployment sofort verfügbar.

## Verschlüsselung und Datenschutz

Backups enthalten personenbezogene Daten (Namen, Qualifikationen, Kosten) und Zertifikatsdateien.

- Archive mit `age` oder `gpg` verschlüsseln, sobald sie das Host-System verlassen
- Schlüssel **nicht** im selben Repository oder Volume ablegen
- Aufbewahrungsfrist definieren und einhalten – Backups sind von Löschanträgen mit betroffen
- Zugriff auf das Backup-Verzeichnis auf Administratoren beschränken

## Monitoring

Ein Backup, das still fehlschlägt, ist der Normalfall – deshalb aktiv überwachen:

- Der Backup-Service schreibt bei Erfolg einen Zeitstempel nach `/backups/last-success`
- `/api/health` liest diesen Zeitstempel und meldet `degraded`, wenn er älter als 26 Stunden ist
- Der Container-Healthcheck bzw. das Monitoring alarmiert darauf
- Zusätzlich: Log-Zeile pro Lauf als JSON nach stdout (`docker compose logs backup`)

## Restore

```bash
# 1. Anwendung stoppen (nie in eine laufende DB zurückspielen)
docker compose stop app

# 2. Restore-Skript mit dem gewünschten Archiv
docker compose run --rm backup /scripts/restore.sh /backups/fv-backup-2026-08-10T02-30.tar.gz

# 3. Integrität prüfen und starten
docker compose up -d app
docker compose logs -f app
```

Das Skript legt vor dem Überschreiben automatisch eine Sicherung des aktuellen Zustands an
(`/backups/pre-restore-*`) und verlangt eine explizite Bestätigung.

## Restore-Übung (quartalsweise, dokumentiert)

1. Aktuelles Backup auf eine **Testinstanz** zurückspielen (nicht auf Produktion)
2. Anmelden, eine Fortbildung öffnen, ein Zertifikat herunterladen – Datenbank und Uploads passen zusammen
3. `PRAGMA integrity_check` läuft ohne Befund
4. Benötigte Zeit messen und mit dem RTO-Ziel vergleichen
5. Ergebnis mit Datum in `docs/backup-strategy.md` unter "Restore-Protokoll" ergänzen

### Restore-Protokoll

| Datum | Backup vom | Dauer | Ergebnis | Durchgeführt von |
|-------|-----------|-------|----------|------------------|
| _–_ | _–_ | _–_ | _–_ | _–_ |

## Was NICHT als Backup zählt
- Ein Volume-Snapshot der laufenden Datenbank (siehe goldene Regel)
- Das Git-Repository (enthält keine Nutzdaten)
- Ein Docker-Image (enthält bewusst keine Daten)
- Eine Kopie auf demselben Volume, das ausfallen kann
