# Security Headers (Nuxt)

Schutz gegen XSS, Clickjacking, MIME-Sniffing und andere verbreitete Web-Angriffe.

## Variante A – `nuxt-security` (empfohlen)

```bash
npx nuxi module add security
```

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  modules: ['nuxt-security'],
  security: {
    headers: {
      xFrameOptions: 'DENY',
      xContentTypeOptions: 'nosniff',
      referrerPolicy: 'origin-when-cross-origin',
      strictTransportSecurity: {
        maxAge: 31_536_000,
        includeSubdomains: true,
      },
      permissionsPolicy: {
        camera: [],
        microphone: [],
        geolocation: [],
      },
      contentSecurityPolicy: {
        'default-src': ["'self'"],
        'script-src': ["'self'", "'nonce-{{nonce}}'", "'strict-dynamic'"],
        'style-src': ["'self'", "'unsafe-inline'"],
        'img-src': ["'self'", 'data:', 'blob:'],
        'connect-src': ["'self'"],
        'frame-ancestors': ["'none'"],
        'object-src': ["'none'"],
      },
    },
  },
})
```

Das Modul bringt zusätzlich CSRF-Schutz, Request-Size-Limits und den Rate Limiter mit
(siehe `docs/rate-limiting.md`).

## Variante B – ohne Modul über `routeRules`

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  routeRules: {
    '/**': {
      headers: {
        'X-Frame-Options': 'DENY',
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'origin-when-cross-origin',
        'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
        'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
      },
    },
  },
})
```

## Was die Header bewirken

| Header | Schutz |
|--------|--------|
| X-Frame-Options: DENY | Verhindert das Einbetten der Anwendung in iframes (Clickjacking) |
| X-Content-Type-Options: nosniff | Verhindert das Erraten von Inhaltstypen durch den Browser (MIME-Sniffing) |
| Referrer-Policy | Begrenzt, wie viel URL-Information an andere Seiten übertragen wird |
| Strict-Transport-Security | Erzwingt HTTPS-Verbindungen |
| Permissions-Policy | Schaltet nicht benötigte Browser-APIs (Kamera, Mikrofon, Standort) ab |
| Content-Security-Policy | Stärkster Schutz gegen XSS – begrenzt, welche Ressourcen geladen werden dürfen |

## HSTS und Docker
`Strict-Transport-Security` nur aktivieren, wenn die Anwendung tatsächlich über HTTPS erreichbar ist.
Im Container läuft die App in der Regel per HTTP hinter einem Reverse Proxy (Traefik/Caddy/nginx),
der TLS terminiert. Entweder setzt der Proxy den Header, oder die App – aber nur einmal, nicht doppelt.
In der lokalen Entwicklung ohne TLS gehört HSTS deaktiviert.

## Content-Security-Policy einführen
Eine zu strenge CSP legt die Anwendung lahm. Vorgehen:
1. Zuerst im Report-Only-Modus starten (`nuxt-security`: `contentSecurityPolicy` + `reportOnly: true`)
2. Alle Seiten durchklicken und die Konsolen-Verstöße auswerten
3. Nur die tatsächlich benötigten Quellen ergänzen – keine Wildcards, kein `unsafe-eval`
4. Erst danach auf den durchsetzenden Modus umstellen

Da die Anwendung keine externen Ressourcen lädt (Fonts und Icons liegen lokal), ist eine strenge
`default-src 'self'`-Policy realistisch erreichbar.

## Verifikation nach dem Deployment
1. Chrome DevTools öffnen
2. Tab "Network"
3. Beliebigen Request auf die Anwendung anklicken
4. Abschnitt "Response Headers" prüfen
5. Alle gesetzten Header müssen vorhanden sein

Zusätzlich extern prüfen: `curl -I https://fortbildung.intern.example.org` oder securityheaders.com
(nur bei öffentlich erreichbaren Installationen).
