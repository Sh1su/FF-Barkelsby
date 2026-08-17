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
