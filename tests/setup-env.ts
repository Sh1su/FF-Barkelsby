/**
 * Umgebung fuer Tests. Der in den Tests gestartete Nitro-Server erbt diese Variablen,
 * bekommt also eine eigene Datenbank und eigene Seed-Konten – niemals die Entwicklungsdaten.
 */
const defaults: Record<string, string> = {
  NUXT_DB_PATH: './tests/.tmp/test.db',
  NUXT_SESSION_PASSWORD: 'test-session-password-mindestens-32-zeichen',
  NUXT_ADMIN_EMAIL: 'wehrfuehrung@test.local',
  NUXT_ADMIN_PASSWORD: 'start-admin-passwort',
  NUXT_GUEST_EMAIL: 'gast@test.local',
  NUXT_GUEST_PASSWORD: 'start-gast-passwort',
}

for (const [key, value] of Object.entries(defaults)) {
  process.env[key] ||= value
}
