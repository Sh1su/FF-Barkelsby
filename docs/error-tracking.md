# Error Tracking (self-hosted)

Produktionsfehler automatisch erfassen, damit Probleme bekannt sind, bevor Nutzer sie melden.
Da die Anwendung on-premise läuft, ist eine selbst gehostete Lösung die Standardwahl.

## Stufe 1 – Strukturierte Logs (immer, Minimum)

Nitro-Hook für alle unbehandelten Fehler:

```ts
// server/plugins/error-logging.ts
export default defineNitroPlugin((nitro) => {
  nitro.hooks.hook('error', (error, { event }) => {
    console.error(JSON.stringify({
      level: 'error',
      time: new Date().toISOString(),
      path: event?.path,
      method: event?.method,
      message: error.message,
      stack: error.stack,
    }))
  })
})
```

Clientseitige Fehler:
```ts
// app/plugins/error-logging.client.ts
export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.hook('vue:error', (error, _instance, info) => {
    $fetch('/api/client-errors', {
      method: 'POST',
      body: { message: String(error), info, url: window.location.href },
    }).catch(() => {})
  })
})
```

Regeln:
- Ausgabe als JSON nach stdout – Docker sammelt das automatisch (`docker compose logs -f app`)
- **Niemals** Passwörter, Tokens, Session-Cookies oder personenbezogene Inhalte loggen
- Nutzer sehen nur eine verständliche deutsche Fehlermeldung, niemals den Stacktrace
- Log-Rotation im Compose konfigurieren (siehe `docs/docker-deployment.md`)

## Stufe 2 – GlitchTip im eigenen Compose-Stack (empfohlen)

GlitchTip ist Sentry-API-kompatibel und selbst hostbar – dieselbe SDK, keine Daten außer Haus.

```yaml
# Auszug docker-compose.yml
glitchtip:
  image: glitchtip/glitchtip:latest
  environment:
    DATABASE_URL: postgres://glitchtip:secret@glitchtip-db:5432/glitchtip
    SECRET_KEY: ${GLITCHTIP_SECRET_KEY}
    PORT: 8000
  ports: ['8000:8000']
```

Anbindung in der App:
```bash
npx nuxi module add sentry
```
```ts
// nuxt.config.ts
export default defineNuxtConfig({
  modules: ['@sentry/nuxt/module'],
  runtimeConfig: {
    public: { sentry: { dsn: '' } },   // gefüllt aus NUXT_PUBLIC_SENTRY_DSN
  },
})
```
```bash
# .env
NUXT_PUBLIC_SENTRY_DSN=http://xxx@glitchtip:8000/1
```

Setup prüfen: einmalig `throw new Error('Fehler-Tracking Test')` in einer Route auslösen und im
GlitchTip-Dashboard kontrollieren – danach wieder entfernen.

## Stufe 3 – Sentry SaaS

Nur einsetzen, wenn Datenschutz und AV-Vertrag geklärt sind. Technisch identische Einbindung,
nur mit anderer DSN. Bei personenbezogenen Daten: `sendDefaultPii: false`, `beforeSend` zum Entfernen
von E-Mail-Adressen und Namen.

## Was du bekommst
- Automatische Erfassung von Server- und Client-Fehlern
- Stacktraces mit Source Maps (Source Maps beim Build erzeugen, aber **nicht** öffentlich ausliefern)
- Gruppierung und Deduplizierung gleicher Fehler
- Benachrichtigung per E-Mail bei neuen Fehlerklassen

## Fehlerbehandlung in der Anwendung
```ts
throw createError({
  statusCode: 403,
  statusMessage: 'Keine Berechtigung für diesen Antrag',
})
```
- Erwartete Fachfehler mit passendem Statuscode werfen, nicht ins Error-Tracking spülen
- Unerwartete Fehler laufen automatisch in den Nitro-Error-Hook
- Globale Fehlerseite in `app/error.vue` mit verständlichem deutschen Text und Rücksprung-Link
