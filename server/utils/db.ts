import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import * as schema from '../database/schema'

export type AppDatabase = ReturnType<typeof drizzle<typeof schema>>

let instance: AppDatabase | undefined
let connection: Database.Database | undefined

/**
 * Oeffnet die SQLite-Verbindung mit den Betriebsparametern aus .claude/rules/database.md.
 * WAL ist Voraussetzung fuer die Litestream-Replikation.
 */
export function createConnection(path: string): Database.Database {
  const absolute = resolve(path)
  mkdirSync(dirname(absolute), { recursive: true })

  const db = new Database(absolute)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  db.pragma('busy_timeout = 5000')
  db.pragma('synchronous = NORMAL')
  return db
}

export function useDatabase(): AppDatabase {
  if (!instance) {
    const path = process.env.NUXT_DB_PATH || useRuntimeConfig().dbPath
    connection = createConnection(path)
    instance = drizzle(connection, { schema })
  }
  return instance
}

/** Nur fuer Tests: bestehende Verbindung verwerfen bzw. eine eigene setzen. */
export function _setDatabase(db: AppDatabase | undefined, raw?: Database.Database) {
  connection?.close()
  instance = db
  connection = raw
}

export { schema }
