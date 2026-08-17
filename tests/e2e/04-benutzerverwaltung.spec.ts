import { expect, test } from '@playwright/test'
import { ACCOUNTS, fillStable, login, signIn } from './helpers'

// Diese Datei laeuft nach den anderen E2E-Dateien (alphabetisch): sie fasst das
// Gast-Passwort an. Am Ende steht wieder das Passwort aus `ACCOUNTS`, damit die
// nachfolgenden visuellen Tests unveraendert weiterlaufen.

const ZWISCHENPASSWORT = 'e2e-gast-zwischenpasswort-2026'

async function benutzerTab(page: import('@playwright/test').Page) {
  await signIn(page, 'admin')
  await page.goto('/verwaltung')
  await page.getByRole('tab', { name: 'Benutzerverwaltung' }).click()
  await expect(page.getByTestId('user-registry')).toBeVisible()
}

test.describe.serial('FV-7 Benutzerverwaltung', () => {
  test('AC-1: der dritte Tab listet Konten mit Rolle und Zustand', async ({ page }) => {
    await benutzerTab(page)

    const gast = page.getByTestId('user-row').filter({ hasText: ACCOUNTS.guest.email })
    await expect(gast).toContainText('Gast-Zugang')
    await expect(gast).toContainText('Aktiv')

    const verwaltung = page.getByTestId('user-row').filter({ hasText: ACCOUNTS.admin.email })
    await expect(verwaltung).toContainText('Verwaltung')

    // Der Gast-Zugang laesst sich nicht abschalten – die Schaltflaeche fehlt (AC-7).
    await expect(gast.getByTestId('user-toggle')).toHaveCount(0)
    await expect(verwaltung.getByTestId('user-toggle')).toBeVisible()
  })

  test('AC-3/AC-12: das neue Gast-Passwort gilt sofort und muss gewechselt werden', async ({ page }) => {
    await benutzerTab(page)

    const gast = page.getByTestId('user-row').filter({ hasText: ACCOUNTS.guest.email })
    await gast.getByTestId('user-password').click()

    await fillStable(page.getByTestId('user-password-input'), ZWISCHENPASSWORT)
    await page.getByTestId('user-password-submit').click()

    await expect(gast.getByTestId('user-startpasswort')).toBeVisible()

    // Das neue Passwort gilt sofort – und weil es die Wehrfuehrung gesetzt hat,
    // verlangt die Anmeldung einen Wechsel (AC-12).
    await login(page, ACCOUNTS.guest.email, ZWISCHENPASSWORT)
    await expect(page).toHaveURL(/\/passwort-aendern/)

    // Zurueck auf den gemeinsamen Ausgangszustand fuer die folgenden Testdateien.
    await fillStable(page.getByTestId('password-current'), ZWISCHENPASSWORT)
    await fillStable(page.getByTestId('password-new'), ACCOUNTS.guest.password)
    await page.getByTestId('password-submit').click()

    await expect(page).not.toHaveURL(/\/passwort-aendern/)
  })
})
