import { lt, eq } from 'drizzle-orm'
import { revokedSessions } from '../database/schema'

/**
 * Sperrliste fuer abgemeldete Sessions (FV-1, AC-12).
 *
 * Eine versiegelte Cookie-Session laesst sich nicht "loeschen" – ohne diese Liste bliebe ein
 * kopiertes Cookie bis zum Ablauf gueltig. Eintraege verfallen mit der Session selbst.
 */
export function revokeSession(sid: string, expiresAt: number): void {
  const db = useDatabase()

  db.insert(revokedSessions)
    .values({ sid, expiresAt: new Date(expiresAt) })
    .onConflictDoNothing()
    .run()

  // Aufraeumen: abgelaufene Eintraege muessen nicht aufbewahrt werden.
  db.delete(revokedSessions).where(lt(revokedSessions.expiresAt, new Date())).run()
}

export function isSessionRevoked(sid: string): boolean {
  const row = useDatabase()
    .select({ sid: revokedSessions.sid })
    .from(revokedSessions)
    .where(eq(revokedSessions.sid, sid))
    .get()

  return Boolean(row)
}
