# Database Optimization (SQLite + Drizzle)

SQLite ist für diese Anwendung schnell genug – solange die Grundregeln eingehalten werden.
Der Engpass ist fast nie die Datenbank selbst, sondern fehlende Indizes und N+1-Abfragen.

## 1. PRAGMAs beim Verbindungsaufbau

```ts
// server/utils/db.ts
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import * as schema from '../database/schema'

const sqlite = new Database(process.env.NUXT_DATABASE_PATH ?? '/data/app.db')

sqlite.pragma('journal_mode = WAL')    // Leser blockieren den Schreiber nicht mehr
sqlite.pragma('foreign_keys = ON')     // Fremdschlüssel werden sonst NICHT erzwungen
sqlite.pragma('busy_timeout = 5000')   // wartet, statt sofort SQLITE_BUSY zu werfen
sqlite.pragma('synchronous = NORMAL')  // sinnvoller Kompromiss zusammen mit WAL

export const db = drizzle(sqlite, { schema })
```

## 2. Indizes

Index auf jede Spalte, die in WHERE, ORDER BY oder JOIN vorkommt:

```ts
// server/database/schema.ts
export const participations = sqliteTable('participations', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  trainingId: text('training_id').notNull().references(() => trainings.id, { onDelete: 'restrict' }),
  status: text('status', { enum: ['requested', 'approved', 'rejected', 'completed', 'cancelled'] }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
}, (t) => [
  index('idx_participations_user_created').on(t.userId, t.createdAt),
  index('idx_participations_status').on(t.status),
  uniqueIndex('uq_participation_user_training').on(t.userId, t.trainingId),
])
```

- **Faustregel:** Spalte in WHERE/ORDER BY *und* Tabelle wächst über ~1000 Zeilen → Index
- Zusammengesetzte Indizes in der Reihenfolge nutzen, in der gefiltert und sortiert wird
- Indizes gehören ins Schema, damit sie automatisch Teil der Migration sind
- Prüfen, ob ein Index greift: `EXPLAIN QUERY PLAN SELECT …` – steht dort `SCAN`, fehlt ein Index

## 3. N+1-Abfragen vermeiden

```ts
// Schlecht: 1 Query für die Teilnahmen + N Queries für die Fortbildungen
const rows = await db.select().from(participations).where(eq(participations.userId, userId))
for (const row of rows) {
  const training = await db.select().from(trainings).where(eq(trainings.id, row.trainingId))
}

// Gut: eine Query über Relational Queries
const rows = await db.query.participations.findMany({
  where: eq(participations.userId, userId),
  with: { training: { columns: { id: true, title: true, startsAt: true, points: true } } },
  limit: 25,
})
```

## 4. Immer begrenzen und paginieren

```ts
// Schlecht: liefert alle Zeilen
const all = await db.select().from(trainings)

// Gut: harte Obergrenze
const page = await db.select().from(trainings).limit(25).offset((pageNumber - 1) * 25)
```

Für lange Listen (Teilnahmen, Audit-Log) Keyset-Pagination bevorzugen: `where(lt(t.createdAt, cursor))`
statt großer `offset`-Werte.

## 5. Nur benötigte Spalten selektieren

```ts
// Schlecht: holt auch passwordHash und interne Felder
const users = await db.select().from(usersTable)

// Gut
const users = await db.select({
  id: usersTable.id,
  name: usersTable.name,
  department: usersTable.departmentId,
}).from(usersTable)
```

Ein Passwort-Hash darf niemals eine API-Route verlassen – am besten schon in der Query ausschließen.

## 6. Caching

Für Daten, die sich selten ändern (Kategorien, Anbieter, Jahresstatistiken):

```ts
// server/utils/cached.ts
export const getCategories = defineCachedFunction(
  async () => db.select().from(categories),
  { name: 'categories', maxAge: 60 * 60 },
)
```

**Cachen:** Stammdaten, teure Aggregationen, nutzerübergreifende Auswertungen
**Nicht cachen:** offene Anträge, persönliche Punktestände, alles Genehmigungsrelevante
Nach Schreibvorgängen den Cache aktiv invalidieren, nicht auf den Ablauf warten.

## 7. Schreibvorgänge und Transaktionen

SQLite erlaubt genau einen Schreiber gleichzeitig. Deshalb:

```ts
db.transaction((tx) => {
  tx.update(participations).set({ status: 'completed' }).where(eq(participations.id, id)).run()
  tx.insert(pointsLedger).values({ userId, points, participationId: id }).run()
  tx.insert(auditLog).values({ actorId, action: 'participation.completed', targetId: id }).run()
})
```

- Transaktionen kurz halten, keine HTTP-Requests, E-Mail-Versände oder Dateioperationen darin
- Massenimporte in Batches (z. B. 500 Zeilen pro Transaktion) statt einzeln

## 8. Wartung & Backup

```bash
# Konsistentes Backup im laufenden Betrieb (NICHT einfach die Datei kopieren)
sqlite3 /data/app.db "VACUUM INTO '/data/backups/app-$(date +%F).db'"

# Statistiken für den Query Planner aktualisieren (nach großen Datenmengen)
sqlite3 /data/app.db "ANALYZE;"

# Integritätsprüfung
sqlite3 /data/app.db "PRAGMA integrity_check;"
```

Backups gehören ins gemountete Volume bzw. auf einen externen Speicher und sind genauso zu schützen
wie die Produktivdaten (personenbezogene Daten).
