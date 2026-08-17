import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { createConnection, type AppDatabase } from '../utils/db'
import { createPasswordHash } from '../utils/password'
import * as schema from './schema'
import { users } from './schema'

export interface SeedAccounts {
  adminEmail: string
  adminPassword: string
  guestEmail: string
  guestPassword: string
}

/**
 * Legt das geteilte Gast-Konto und den Erst-Admin an.
 *
 * Idempotent: existiert die E-Mail bereits, bleibt der Datensatz unveraendert – ein Neustart
 * setzt also niemals ein zwischenzeitlich geaendertes Passwort zurueck (FV-1, AC-9).
 * Der Erst-Admin wird mit `mustChangePassword` angelegt (FV-1, AC-10).
 */
export async function seedAccounts(db: AppDatabase, accounts: SeedAccounts) {
  const created: string[] = []

  const ensure = async (
    email: string,
    password: string,
    role: 'admin' | 'guest',
    displayName: string,
  ) => {
    const existing = db.select({ id: users.id }).from(users).where(eq(users.email, email)).get()
    if (existing) return

    db.insert(users)
      .values({
        id: randomUUID(),
        email,
        passwordHash: await createPasswordHash(password),
        role,
        displayName,
        mustChangePassword: true,
      })
      .run()
    created.push(role)
  }

  await ensure(accounts.adminEmail, accounts.adminPassword, 'admin', 'Wehrführung')
  await ensure(accounts.guestEmail, accounts.guestPassword, 'guest', 'Gast-Zugang')

  return created
}

/** Pflichtvariablen fuer den Start. Fehlen sie, bricht die Anwendung mit klarer Meldung ab. */
export function readSeedEnv(env: NodeJS.ProcessEnv = process.env): SeedAccounts {
  const required = [
    'NUXT_ADMIN_EMAIL',
    'NUXT_ADMIN_PASSWORD',
    'NUXT_GUEST_EMAIL',
    'NUXT_GUEST_PASSWORD',
  ] as const

  const missing = required.filter(key => !env[key])
  if (missing.length > 0) {
    throw new Error(
      `Fehlende Umgebungsvariablen: ${missing.join(', ')}. Siehe .env.example.`,
    )
  }

  return {
    adminEmail: env.NUXT_ADMIN_EMAIL!,
    adminPassword: env.NUXT_ADMIN_PASSWORD!,
    guestEmail: env.NUXT_GUEST_EMAIL!,
    guestPassword: env.NUXT_GUEST_PASSWORD!,
  }
}

/**
 * Einstiegspunkt fuer `npm run db:seed`.
 * Bewusst als Funktion statt Top-Level-Await: die Datei wird auch in den Nitro-Server
 * gebuendelt, und dessen Zielumgebung erlaubt kein Top-Level-Await.
 */
export async function seedFromEnv(dbPath = process.env.NUXT_DB_PATH || './data/app.db') {
  const connection = createConnection(dbPath)
  const db = drizzle(connection, { schema })
  const created = await seedAccounts(db, readSeedEnv())
  connection.close()
  return created
}
