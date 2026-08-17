import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { createConnection } from '../../server/utils/db'
import * as schema from '../../server/database/schema'
import { signups } from '../../server/database/schema'
import type { SignupStatus } from '../../shared/constants'

/**
 * Anmeldungen entstehen erst mit FV-5. Fuer die Pruefungen in FV-3 (Loeschsperre,
 * Kapazitaetsuntergrenze) schreiben die Tests direkt in die Testdatenbank – WAL erlaubt
 * eine zweite Verbindung neben dem laufenden Server.
 */
/** Liest den Einwilligungszeitpunkt einer Anmeldung direkt aus der Testdatenbank (FV-5, AC-12). */
export function readSignupConsent(dbName: string, email: string): Date | null {
  const connection = createConnection(`./tests/.tmp/${dbName}.db`)
  const db = drizzle(connection, { schema })

  const row = db
    .select({ consentAt: signups.consentAt })
    .from(signups)
    .where(eq(signups.email, email))
    .get()

  connection.close()
  return row?.consentAt ?? null
}

export function insertSignup(
  dbName: string,
  courseId: string,
  status: SignupStatus = 'offen',
  email = `teilnehmer-${randomUUID().slice(0, 8)}@test.local`,
  cancelToken = randomUUID(),
) {
  const connection = createConnection(`./tests/.tmp/${dbName}.db`)
  const db = drizzle(connection, { schema })

  const id = randomUUID()
  db.insert(signups)
    .values({
      id,
      courseId,
      firstName: 'Testi',
      lastName: 'Teilnehmer',
      email,
      status,
      cancelToken,
    })
    .run()

  connection.close()
  return id
}
