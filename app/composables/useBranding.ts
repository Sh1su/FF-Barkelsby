/**
 * Erscheinungsbild der Wehr (Name, Kurzname, Logo) – ueber die Verwaltung editierbar
 * (`server/api/admin/settings/branding*`). Alle Seiten fragen denselben Schluessel `branding`
 * ab, Nuxt haelt das Ergebnis darum ueber Navigationen hinweg im Payload-Cache statt bei jeder
 * Seite neu zu laden. Oeffentlich erreichbar (`GET /api/branding`), damit auch die Login-Seite
 * vor der Anmeldung Name und Logo zeigen kann.
 */
export function useBranding() {
  return useAsyncData('branding', () => $fetch('/api/branding'))
}
