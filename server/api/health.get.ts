import { sql } from 'drizzle-orm'

/** Healthcheck fuer Docker (FV-1, AC-14). Ohne Anmeldung erreichbar, ohne Datenpreisgabe. */
export default defineEventHandler(() => {
  try {
    useDatabase().get(sql`select 1`)
    return { status: 'ok' }
  }
  catch {
    throw createError({ statusCode: 503, statusMessage: 'Datenbank nicht erreichbar.' })
  }
})
