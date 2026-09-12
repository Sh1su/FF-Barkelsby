import { expect, test } from '@playwright/test'
import { ACCOUNTS, fillStable, login, signIn } from './helpers'

// Diese Datei laeuft nach den anderen E2E-Dateien (alphabetisch): sie fasst das
// Mitglied-Passwort an. Am Ende steht wieder das Passwort aus `ACCOUNTS`, damit die
// nachfolgenden visuellen Tests unveraendert weiterlaufen.

const ZWISCHENPASSWORT = 'e2e-mitglied-zwischenpasswort-2026'

async function benutzerTab(page: import('@playwright/test').Page) {
  await signIn(page, 'admin')
  await page.goto('/verwaltung')
  await page.getByRole('tab', { name: 'Benutzerverwaltung' }).click()
  await expect(page.getByTestId('user-registry')).toBeVisible()
}

test.describe.serial('FV-7 Benutzerverwaltung', () => {
  test('AC-1: der dritte Tab listet Konten mit Rolle und Zustand', async ({ page }) => {
    await benutzerTab(page)

    const mitglied = page.getByTestId('user-row').filter({ hasText: ACCOUNTS.member.email })
    await expect(mitglied).toContainText('Mitglied')
    await expect(mitglied).toContainText('Aktiv')

    const verwaltung = page.getByTestId('user-row').filter({ hasText: ACCOUNTS.admin.email })
    await expect(verwaltung).toContainText('Verwaltung')

    // FV-15: seit persoenliche Mitgliedskonten das eine geteilte Gast-Konto abloesen,
    // laesst sich auch ein Mitgliedskonto abschalten – die Schaltflaeche fehlt nicht mehr.
    await expect(mitglied.getByTestId('user-toggle')).toBeVisible()
    await expect(verwaltung.getByTestId('user-toggle')).toBeVisible()
  })

  test('AC-3/AC-12: das neue Mitglied-Passwort gilt sofort und muss gewechselt werden', async ({ page }) => {
    await benutzerTab(page)

    const mitglied = page.getByTestId('user-row').filter({ hasText: ACCOUNTS.member.email })
    await mitglied.getByTestId('user-password').click()

    await fillStable(page.getByTestId('user-password-input'), ZWISCHENPASSWORT)
    await page.getByTestId('user-password-submit').click()

    await expect(mitglied.getByTestId('user-startpasswort')).toBeVisible()

    // Das neue Passwort gilt sofort – und weil es die Wehrfuehrung gesetzt hat,
    // verlangt die Anmeldung einen Wechsel (AC-12).
    await login(page, ACCOUNTS.member.email, ZWISCHENPASSWORT)
    await expect(page).toHaveURL(/\/passwort-aendern/)

    // Zurueck auf den gemeinsamen Ausgangszustand fuer die folgenden Testdateien.
    await fillStable(page.getByTestId('password-current'), ZWISCHENPASSWORT)
    await fillStable(page.getByTestId('password-new'), ACCOUNTS.member.password)
    await page.getByTestId('password-submit').click()

    await expect(page).not.toHaveURL(/\/passwort-aendern/)
  })

  test('FV-16, AC-6/AC-7: ein Mitglied anlegen zeigt das erzeugte Passwort einmalig', async ({ page }) => {
    await benutzerTab(page)

    await page.getByTestId('member-new').click()
    await fillStable(page.getByTestId('member-create-email'), 'neues-mitglied-e2e@e2e.local')
    await fillStable(page.getByTestId('member-create-name'), 'Neues Mitglied E2E')
    await page.getByTestId('member-create-submit').click()

    await expect(page.getByTestId('member-generated-email')).toHaveValue('neues-mitglied-e2e@e2e.local')
    const passwortfeld = page.getByTestId('member-generated-password')
    await expect(passwortfeld).toHaveAttribute('type', 'password')
    const passwort = await passwortfeld.inputValue()
    expect(passwort.length).toBeGreaterThanOrEqual(12)

    await page.getByTestId('member-generated-close').click()
    await expect(passwortfeld).toHaveCount(0)

    // Das erzeugte Konto ist tatsaechlich ein Mitgliedskonto und in der Liste sichtbar.
    const neueZeile = page.getByTestId('user-row').filter({ hasText: 'neues-mitglied-e2e@e2e.local' })
    await expect(neueZeile).toContainText('Mitglied')
  })
})
