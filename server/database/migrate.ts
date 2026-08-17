import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { Database } from 'better-sqlite3'
import { createConnection } from '../utils/db'

/**
 * Migrationen anwenden.
 *
 * Bewusst ein eigener, sehr kleiner Migrator statt `drizzle-orm/migrator`: dieser liest die
 * SQL-Dateien ueber einen Pfad vom Dateisystem, den es im gebuendelten Nitro-Server nicht mehr
 * gibt (und im Container erst recht nicht). Die Dateien liegen deshalb unter
 * `server/assets/migrations` und werden von Nitro in den Build uebernommen; gelesen werden sie
 * ueber einen austauschbaren Leser – im Server aus dem Asset-Storage, in der CLI vom Dateisystem.
 */

export interface MigrationJournal {
  entries: { idx: number, tag: string }[]
}

export interface MigrationSource {
  journal: () => Promise<MigrationJournal | null>
  sql: (tag: string) => Promise<string | null>
}

export const MIGRATIONS_FOLDER = resolve('./server/assets/migrations')

/** Liest die Migrationen direkt vom Dateisystem (CLI, Tests). */
export const filesystemSource: MigrationSource = {
  journal: async () => {
    const raw = readFileSync(resolve(MIGRATIONS_FOLDER, 'meta/_journal.json'), 'utf8')
    return JSON.parse(raw) as MigrationJournal
  },
  sql: async (tag: string) => readFileSync(resolve(MIGRATIONS_FOLDER, `${tag}.sql`), 'utf8'),
}

function ensureMigrationTable(connection: Database) {
  connection.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      tag TEXT PRIMARY KEY,
      applied_at INTEGER NOT NULL
    )
  `)
}

/**
 * Wendet alle noch nicht eingespielten Migrationen an – jede in einer eigenen Transaktion,
 * damit ein Fehler keine halb angewendete Migration hinterlaesst.
 */
export async function applyMigrations(
  connection: Database,
  source: MigrationSource = filesystemSource,
): Promise<string[]> {
  ensureMigrationTable(connection)

  const journal = await source.journal()
  if (!journal) {
    throw new Error('Keine Migrationen gefunden (meta/_journal.json fehlt).')
  }

  const applied = new Set(
    connection.prepare('SELECT tag FROM schema_migrations').all().map(row => (row as { tag: string }).tag),
  )

  const executed: string[] = []

  for (const entry of [...journal.entries].sort((a, b) => a.idx - b.idx)) {
    if (applied.has(entry.tag)) continue

    const sql = await source.sql(entry.tag)
    if (!sql) throw new Error(`Migration ${entry.tag} fehlt.`)

    const statements = sql
      .split('--> statement-breakpoint')
      .map(statement => statement.trim())
      .filter(Boolean)

    const run = connection.transaction(() => {
      for (const statement of statements) connection.exec(statement)
      connection
        .prepare('INSERT INTO schema_migrations (tag, applied_at) VALUES (?, ?)')
        .run(entry.tag, Math.floor(Date.now() / 1000))
    })

    run()
    executed.push(entry.tag)
  }

  return executed
}

/** Bequemer Einstieg fuer CLI und Tests: oeffnet die Datenbank selbst. */
export async function runMigrations(
  dbPath: string = process.env.NUXT_DB_PATH || './data/app.db',
  source: MigrationSource = filesystemSource,
): Promise<string[]> {
  const connection = createConnection(dbPath)
  try {
    return await applyMigrations(connection, source)
  }
  finally {
    connection.close()
  }
}
