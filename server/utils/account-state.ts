import { eq } from 'drizzle-orm'
import { users } from '../database/schema'

/**
 * Ist das Konto einer laufenden Sitzung noch gueltig? (FV-7, AC-9)
 *
 * Eine Abfrage je Anfrage auf einen Primaerschluessel – bei SQLite auf derselben Maschine
 * vernachlaessigbar, dafuer wirkt ein Deaktivieren sofort statt erst nach Ablauf der Sitzung.
 */
export function isAccountActive(userId: string): boolean {
  const konto = useDatabase()
    .select({ deactivatedAt: users.deactivatedAt })
    .from(users)
    .where(eq(users.id, userId))
    .get()

  return Boolean(konto) && konto!.deactivatedAt === null
}
