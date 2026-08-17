import { defineConfig, devices } from '@playwright/test'

const PORT = 3124
const BASE_URL = `http://127.0.0.1:${PORT}`

/**
 * Eigene Konfiguration fuer die QA-Bildstrecke (`tests/qa`).
 * Bewusst getrennt von playwright.config.ts, damit `npm run test:e2e` davon unberuehrt bleibt.
 */
export default defineConfig({
  testDir: './tests/qa',
  workers: 1,
  reporter: 'list',
  timeout: 180_000,
  use: {
    baseURL: BASE_URL,
    locale: 'de-DE',
    timezoneId: 'Europe/Berlin',
    ...devices['Desktop Chrome'],
  },
  webServer: {
    command: `npx nuxt build && npx nuxt preview --port ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: false,
    timeout: 300_000,
    env: {
      NUXT_DB_PATH: './tests/.tmp/qa.db',
      NUXT_SESSION_PASSWORD: 'qa-session-password-mindestens-32-zeichen',
      NUXT_ADMIN_EMAIL: 'wehrfuehrung@e2e.local',
      NUXT_ADMIN_PASSWORD: 'start-admin-passwort',
      NUXT_GUEST_EMAIL: 'gast@e2e.local',
      NUXT_GUEST_PASSWORD: 'start-gast-passwort',
      // Kein echter Mailversand aus Tests heraus – sonst greift die produktive .env.
      NUXT_SMTP_HOST: '',
      NUXT_SMTP_USER: '',
      NUXT_SMTP_PASSWORD: '',
      NUXT_SMTP_FROM: '',
    },
  },
})
