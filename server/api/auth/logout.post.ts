/** Verwirft die Session serverseitig (FV-1, AC-12). */
export default defineEventHandler(async (event) => {
  await requireAuth(event)

  const session = await getUserSession(event)
  const sid = (session as { sid?: string }).sid
  const expiresAt = (session as { expiresAt?: number }).expiresAt

  // Ohne Eintrag in der Sperrliste bliebe ein kopiertes Cookie bis zum Ablauf gueltig.
  if (sid) {
    revokeSession(sid, expiresAt ?? Date.now() + 60 * 60 * 24 * 30 * 1000)
  }

  await clearUserSession(event)
  return { ok: true }
})
