import { defineConfig, devices } from '@playwright/test'

const PORT = 3123
const BASE_URL = `http://127.0.0.1:${PORT}`

/**
 * E2E laeuft gegen einen eigenen Dev-Server mit eigener Datenbank.
 * Niemals gegen Entwicklungs- oder Produktivdaten testen (.claude/rules/testing.md).
 */
export default defineConfig({
  testDir: './tests',
  testMatch: ['e2e/**/*.spec.ts', 'visual/**/*.spec.ts'],
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: process.env.CI ? 'github' : 'list',
  timeout: 60_000,
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    locale: 'de-DE',
    timezoneId: 'Europe/Berlin',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
  ],
  webServer: {
    // Bewusst gegen den Produktionsbuild statt gegen `nuxt dev`: der Dev-Server kompiliert
    // Seiten erst beim ersten Aufruf und loest dabei einen Reload aus, der Formulareingaben
    // verwirft – das macht E2E-Tests unzuverlaessig.
    command: `npx nuxt build && npx nuxt preview --port ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: false,
    timeout: 300_000,
    env: {
      NUXT_DB_PATH: './tests/.tmp/e2e.db',
      NUXT_SESSION_PASSWORD: 'e2e-session-password-mindestens-32-zeichen',
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
