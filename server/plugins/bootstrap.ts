import type { drizzle } from 'drizzle-orm/better-sqlite3'
import { applyMigrations, type MigrationJournal, type MigrationSource } from '../database/migrate'
import { readSeedEnv, seedAccounts } from '../database/seed'
import type * as schema from '../database/schema'
import { createConnection } from '../utils/db'

/**
 * Startreihenfolge des Containers: Pflichtvariablen pruefen, Migrationen anwenden,
 * Konten anlegen. Fehlt etwas, bricht der Start mit klarer Meldung ab statt still
 * mit Defaults zu laufen (.claude/rules/security.md).
 */

/** Liest die Migrationen aus dem Nitro-Asset-Storage – funktioniert auch im Container. */
function assetSource(): MigrationSource {
  // Nitro haengt server/assets unter dem Mountpoint `assets:server` ein.
  const storage = useStorage('assets:server')

  return {
    journal: async () => {
      const raw = await storage.getItem('migrations/meta/_journal.json')
      if (!raw) return null
      return (typeof raw === 'string' ? JSON.parse(raw) : raw) as MigrationJournal
    },
    sql: async (tag: string) => {
      const raw = await storage.getItem(`migrations/${tag}.sql`)
      if (raw === null || raw === undefined) return null
      return typeof raw === 'string' ? raw : String(raw)
    },
  }
}

export default defineNitroPlugin(async () => {
  const config = useRuntimeConfig()
  const dbPath = process.env.NUXT_DB_PATH || config.dbPath

  if (!process.env.NUXT_SESSION_PASSWORD || process.env.NUXT_SESSION_PASSWORD.length < 32) {
    throw new Error(
      'NUXT_SESSION_PASSWORD fehlt oder ist kürzer als 32 Zeichen. Siehe .env.example.',
    )
  }

  const accounts = readSeedEnv()

  const connection = createConnection(dbPath)
  const executed = await applyMigrations(connection, assetSource())
  connection.close()

  const db = useDatabase()
  const created = await seedAccounts(db as ReturnType<typeof drizzle<typeof schema>>, accounts)

  if (executed.length > 0 || created.length > 0) {
    // eslint-disable-next-line no-console
    console.log(JSON.stringify({
      level: 'info',
      msg: 'bootstrap',
      migrations: executed,
      accounts: created,
    }))
  }
})
