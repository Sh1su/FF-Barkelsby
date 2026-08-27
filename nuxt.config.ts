import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'

// @nuxt/icon's "local" Server-Bundle-Modus baut aus der Icon-Sammlung lediglich die per
// Quellcode-Scan gefundenen Icons in .output/server ein statt der kompletten Sammlung.
// Die komplette lokal installierte Sammlung als Literal einbetten statt sie scannen zu lassen.
const lucideIcons = JSON.parse(
  readFileSync(createRequire(import.meta.url).resolve('@iconify-json/lucide/icons.json'), 'utf-8'),
)

// Alle im Code verwendeten Icon-Namen (siehe `grep -rohE "i-lucide-[a-z0-9-]+" app/`).
// @nuxt/icon erkennt die meisten davon zwar automatisch per Quellcode-Scan und bettet sie
// als kleines Client-Bundle ein, uebersieht dabei aber zuverlaessig einen Teil (u.a. alle
// hier gelisteten) – vermutlich, weil sie nur innerhalb von <script setup> in JS-Objekten
// stehen, nicht als "icon="-Template-Attribut. Fehlt ein Icon im Client-Bundle, versucht
// @nuxt/icon es serverseitig via `fetch()` einer RELATIVEN URL nachzuladen; Node-Fetch kann
// relative URLs nicht aufloesen, das schlaegt beim SSR-Rendering IMMER fehl (Konsole:
// "[Icon] failed to load icon `lucide:…`", Icon bleibt bis zur Client-Hydration leer). Fix:
// alle tatsaechlich benutzten Icons hier explizit auflisten, damit @nuxt/icon sie synchron
// aus dem Client-Bundle liefert und der kaputte Server-Fetch nie ausgeloest wird.
const usedIconNames = [
  'arrow-left',
  'calendar',
  'calendar-days',
  'check',
  'check-circle-2',
  'chevron-down',
  'chevron-left',
  'chevron-right',
  'chevron-up',
  'clipboard-list',
  'clock',
  'dot',
  'download',
  'external-link',
  'eye',
  'eye-off',
  'hourglass',
  'layers',
  'log-out',
  'mail',
  'mail-check',
  'mail-question-mark',
  'mail-x',
  'map-pin',
  'moon',
  'plus',
  'search',
  'search-x',
  'settings',
  'sun',
  'trash-2',
  'user',
  'user-plus',
  'users',
]

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2026-08-10',
  devtools: { enabled: true },

  modules: ['@nuxt/ui', '@nuxt/eslint', 'nuxt-auth-utils', '@nuxt/test-utils/module'],

  css: ['~/assets/css/main.css'],

  future: { compatibilityVersion: 4 },

  typescript: { strict: true, typeCheck: false },

  // Der Farbmodus folgt der Systemeinstellung; die Kopfzeile bietet einen Umschalter.
  colorMode: {
    preference: 'system',
    fallback: 'light',
    classSuffix: '',
  },

  icon: {
    serverBundle: {
      collections: [lucideIcons],
    },
    clientBundle: {
      icons: usedIconNames.map(name => `lucide:${name}`),
    },
  },

  runtimeConfig: {
    // Pfad zur SQLite-Datei. Im Container liegt sie auf dem Volume unter /data.
    dbPath: './data/app.db',
    // Seed-Zugangsdaten fuer den ersten Start (siehe .env.example).
    adminEmail: '',
    adminPassword: '',
    guestEmail: '',
    guestPassword: '',
    // SMTP-Relay (FV-4). Leer = Mailversand deaktiviert, es wird nur protokolliert.
    smtpHost: '',
    smtpPort: '587',
    smtpUser: '',
    smtpPassword: '',
    smtpFrom: '',
    // Das Session-Cookie wird auf die laengere der beiden Laufzeiten gesetzt (Gast, 30 Tage).
    // Die tatsaechliche Gueltigkeit steht als `expiresAt` in der Session und wird
    // serverseitig in server/middleware/auth.ts geprueft (FV-1, AC-8).
    session: {
      name: 'fireedu-session',
      cookie: {
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 30,
      },
    },
    public: {
      baseUrl: 'http://localhost:3000',
      // Name der Wehr – per NUXT_PUBLIC_ORGANISATION_NAME austauschbar, ohne Codeaenderung.
      organisation: {
        name: 'Freiwillige Feuerwehr Musterstadt',
        shortName: 'FW',
      },
    },
  },

  nitro: {
    experimental: { asyncContext: true },
  },

  routeRules: {
    '/**': {
      headers: {
        'X-Frame-Options': 'DENY',
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'origin-when-cross-origin',
        'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
      },
    },
  },

  app: {
    head: {
      htmlAttrs: { lang: 'de' },
      titleTemplate: '%s · Lehrgänge',
    },
  },
})
