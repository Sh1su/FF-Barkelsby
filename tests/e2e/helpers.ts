import { expect, type Locator, type Page } from '@playwright/test'

/** Zugangsdaten der E2E-Instanz (siehe playwright.config.ts). */
export const ACCOUNTS = {
  admin: {
    email: 'wehrfuehrung@e2e.local',
    start: 'start-admin-passwort',
    password: 'e2e-admin-passwort-2026',
  },
  guest: {
    email: 'gast@e2e.local',
    start: 'start-gast-passwort',
    password: 'e2e-gast-passwort-2026',
  },
} as const

/**
 * Fuellt ein Feld und prueft, dass der Wert stehen bleibt.
 *
 * Notwendig, weil Nuxt die serverseitig gerenderte Seite erst uebernimmt (Hydration),
 * wenn das JavaScript geladen ist – ein Wert, der davor eingetippt wird, geht dabei verloren.
 */
export async function fillStable(locator: Locator, value: string) {
  await expect(async () => {
    await locator.fill(value)
    await expect(locator).toHaveValue(value)
  }).toPass({ timeout: 15_000 })
}

export async function login(page: Page, email: string, password: string) {
  await page.goto('/login')

  // Wer schon angemeldet ist, wird von /login weggeleitet – dann erst abmelden.
  if (!page.url().includes('/login')) {
    await page.getByTestId('logout-button').click()
    await expect(page).toHaveURL(/\/login/)
  }

  await fillStable(page.getByTestId('login-email'), email)
  await fillStable(page.getByTestId('login-password'), password)
  await page.getByTestId('login-submit').click()
}

/**
 * Meldet ein Konto an – unabhaengig davon, ob das Startpasswort schon gewechselt wurde.
 * Damit sind die Testdateien nicht auf eine bestimmte Reihenfolge angewiesen.
 */
export async function signIn(page: Page, role: keyof typeof ACCOUNTS) {
  const account = ACCOUNTS[role]

  await login(page, account.email, account.password)

  // Auf die Antwort warten, statt die URL sofort zu lesen – der Klick ist asynchron.
  const angemeldet = await page
    .waitForURL(url => !url.pathname.startsWith('/login'), { timeout: 5000 })
    .then(() => true)
    .catch(() => false)

  if (angemeldet) return

  await login(page, account.email, account.start)
  await expect(page).toHaveURL(/\/passwort-aendern/)
  await fillStable(page.getByTestId('password-current'), account.start)
  await fillStable(page.getByTestId('password-new'), account.password)
  await page.getByTestId('password-submit').click()
  await expect(page).not.toHaveURL(/\/passwort-aendern/)
}
