import { expect, test } from '@playwright/test'
import { fillStable, login } from './helpers'

const ADMIN = { email: 'wehrfuehrung@e2e.local', start: 'start-admin-passwort', neu: 'e2e-admin-passwort-2026' }
const GUEST = { email: 'gast@e2e.local', start: 'start-gast-passwort', neu: 'e2e-gast-passwort-2026' }

// Der Seed legt beide Konten mit erzwungenem Passwortwechsel an. Der erste Test
// erledigt den Wechsel, die folgenden melden sich mit dem neuen Passwort an.
//
// Die Zahlen im Dateinamen sind Absicht: Playwright arbeitet die Dateien alphabetisch ab,
// und der Wechsel des Startpassworts laesst sich nur einmal pruefen. Diese Datei muss
// deshalb vor den anderen E2E-Dateien laufen, die sich ueber `signIn` anmelden.

test.describe.serial('FV-1 Fundament & Login-Gate', () => {
  test('AC-1: ein nicht angemeldeter Aufruf landet auf der Anmeldeseite', async ({ page }) => {
    await page.goto('/')

    await expect(page).toHaveURL(/\/login/)
    await expect(page.getByTestId('login-form')).toBeVisible()
  })

  test('AC-10: der Erst-Admin muss das Startpasswort ändern', async ({ page }) => {
    await login(page, ADMIN.email, ADMIN.start)

    await expect(page).toHaveURL(/\/passwort-aendern/)

    await fillStable(page.getByTestId('password-current'), ADMIN.start)
    await fillStable(page.getByTestId('password-new'), ADMIN.neu)
    await page.getByTestId('password-submit').click()

    await expect(page).toHaveURL(/\/verwaltung/)
  })

  test('AC-10: auch der Gast-Zugang wechselt das Startpasswort', async ({ page }) => {
    await login(page, GUEST.email, GUEST.start)

    await expect(page).toHaveURL(/\/passwort-aendern/)

    await fillStable(page.getByTestId('password-current'), GUEST.start)
    await fillStable(page.getByTestId('password-new'), GUEST.neu)
    await page.getByTestId('password-submit').click()

    await expect(page).toHaveURL(/^http:\/\/127\.0\.0\.1:\d+\/$/)
  })

  test('AC-2: der Gast landet nach der Anmeldung auf der Lehrgangsübersicht', async ({ page }) => {
    await login(page, GUEST.email, GUEST.neu)

    await expect(page.getByRole('heading', { name: 'Aktuelle Lehrgänge' })).toBeVisible()
    // Der Gast sieht keinen Verwaltungslink.
    await expect(page.getByTestId('admin-link')).toHaveCount(0)
  })

  test('AC-3: der Admin landet direkt in der Verwaltung', async ({ page }) => {
    await login(page, ADMIN.email, ADMIN.neu)

    await expect(page).toHaveURL(/\/verwaltung/)
    await expect(page.getByTestId('admin-tabs')).toBeVisible()
  })

  test('AC-4: falsche Zugangsdaten zeigen eine generische Meldung', async ({ page }) => {
    await login(page, GUEST.email, 'ganz-sicher-falsch')

    await expect(page.getByTestId('login-error')).toContainText('E-Mail oder Passwort ist falsch')
    await expect(page).toHaveURL(/\/login/)
  })

  test('AC-11: ein Gast kommt nicht in die Verwaltung', async ({ page }) => {
    await login(page, GUEST.email, GUEST.neu)
    // Erst die Anmeldung abwarten (Klick loest sie nur an) - sonst kann das folgende
    // page.goto() die noch laufende Anmeldung ueberholen und faellt faelschlich auf
    // /login zurueck, weil das Session-Cookie noch nicht gesetzt ist.
    await expect(page).not.toHaveURL(/\/login/)
    await page.goto('/verwaltung')

    await expect(page).toHaveURL(/^http:\/\/127\.0\.0\.1:\d+\/$/)
  })

  test('AC-12: nach dem Abmelden ist die Übersicht wieder gesperrt', async ({ page }) => {
    await login(page, GUEST.email, GUEST.neu)
    await page.getByTestId('logout-button').click()

    await expect(page).toHaveURL(/\/login/)

    await page.goto('/')
    await expect(page).toHaveURL(/\/login/)
  })
})
