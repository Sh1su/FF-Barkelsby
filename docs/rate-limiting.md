# Rate Limiting (Nuxt/Nitro, ohne externe Dienste)

Schutz gegen Brute-Force auf den Login, versehentliche Endlosschleifen und Überlastung der SQLite-Datenbank.

## Wann nötig
- **Login, Passwort-Reset, Registrierung:** verpflichtend
- **Datei-Upload und Export/Report-Routen:** empfohlen (teure Operationen)
- **Übrige API:** großzügiges Basislimit als Sicherheitsnetz

Da die Anwendung als einzelne Container-Instanz läuft, reicht ein In-Memory- bzw. Unstorage-basiertes
Limit. **Kein Upstash, kein externer Redis** – das würde die Offline-Fähigkeit brechen.

## Variante A – `nuxt-security` (empfohlen)

```bash
npx nuxi module add security
```

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  modules: ['nuxt-security'],
  security: {
    rateLimiter: {
      tokensPerInterval: 150,
      interval: 60_000,        // 150 Requests pro Minute pro IP
      headers: true,
      throwError: true,
    },
  },
  routeRules: {
    '/api/auth/login': {
      security: { rateLimiter: { tokensPerInterval: 5, interval: 60_000 } },
    },
    '/api/auth/password-reset': {
      security: { rateLimiter: { tokensPerInterval: 3, interval: 300_000 } },
    },
    '/api/uploads/**': {
      security: { rateLimiter: { tokensPerInterval: 10, interval: 60_000 } },
    },
  },
})
```

## Variante B – eigene Middleware (volle Kontrolle)

```ts
// server/utils/rate-limit.ts
const buckets = new Map<string, { count: number; resetAt: number }>()

export function checkRateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now()
  const bucket = buckets.get(key)

  if (!bucket || bucket.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return { success: true, remaining: limit - 1 }
  }

  bucket.count++
  if (bucket.count > limit) {
    return { success: false, remaining: 0, retryAfter: Math.ceil((bucket.resetAt - now) / 1000) }
  }
  return { success: true, remaining: limit - bucket.count }
}
```

```ts
// server/api/auth/login.post.ts
export default defineEventHandler(async (event) => {
  const ip = getRequestIP(event, { xForwardedFor: true }) ?? 'unknown'
  const body = await readValidatedBody(event, loginSchema.parse)

  // Pro IP UND pro Konto begrenzen – sonst verteilen Angreifer über viele IPs
  for (const key of [`login:ip:${ip}`, `login:user:${body.email.toLowerCase()}`]) {
    const { success, retryAfter } = checkRateLimit(key, 5, 60_000)
    if (!success) {
      throw createError({
        statusCode: 429,
        statusMessage: 'Zu viele Anmeldeversuche. Bitte später erneut versuchen.',
        data: { retryAfter },
      })
    }
  }

  // ... Anmeldung prüfen
})
```

Aufräumen nicht vergessen: abgelaufene Buckets periodisch entfernen, sonst wächst die Map unbegrenzt.

## Empfohlene Limits

| Endpunkt | Limit | Zeitfenster |
|----------|-------|-------------|
| Login | 5 Versuche | 1 Minute (pro IP **und** pro Konto) |
| Passwort-Reset | 3 Anfragen | 5 Minuten |
| Registrierung / Benutzer anlegen | 10 Anfragen | 10 Minuten |
| Datei-Upload (Nachweise) | 10 Anfragen | 1 Minute |
| Export / Report | 5 Anfragen | 1 Minute |
| Übrige API | 150 Anfragen | 1 Minute |

## Wichtig hinter einem Reverse Proxy
Läuft die App hinter Traefik, Caddy oder nginx, sieht sie sonst nur die Proxy-IP:
- Nitro so konfigurieren, dass `X-Forwarded-For` ausgewertet wird
- Der Proxy muss den Header selbst setzen und vom Client kommende Werte überschreiben,
  sonst lässt sich das Limit trivial umgehen

## Ergänzende Maßnahmen
- Verzögerung nach fehlgeschlagenen Logins (exponentielles Backoff pro Konto)
- Konto nach z. B. 10 Fehlversuchen temporär sperren und die Sperre protokollieren
- Fehlgeschlagene Anmeldungen im Audit-Log erfassen (ohne Passwort)
- Wichtig: Rate Limiting ersetzt keine Autorisierung – siehe `.claude/rules/security.md`
