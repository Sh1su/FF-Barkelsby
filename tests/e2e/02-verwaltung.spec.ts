import { expect, test } from '@playwright/test'
import { fillStable, login as signInWith } from './helpers'

const ADMIN = { email: 'wehrfuehrung@e2e.local', password: 'e2e-admin-passwort-2026' }
const GUEST = { email: 'gast@e2e.local', password: 'e2e-gast-passwort-2026' }

async function login(page: import('@playwright/test').Page, email: string, password: string) {
  await signInWith(page, email, password)
  await expect(page).not.toHaveURL(/\/login/)
}

function isoInDays(days: number) {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date.toISOString().slice(0, 10)
}

const TITEL = 'E2E Atemschutz Fortbildung'

test.describe.serial('FV-3 Verwaltung – Lehrgang anlegen und absagen', () => {
  test('AC-1: die Verwaltung ist nur für Admin-Konten erreichbar', async ({ page }) => {
    await login(page, GUEST.email, GUEST.password)
    await page.goto('/verwaltung')

    // Der Gast landet zurück auf der Übersicht und sieht keine Verwaltungsoberfläche.
    await expect(page).toHaveURL(/^http:\/\/127\.0\.0\.1:\d+\/$/)
    await expect(page.getByTestId('admin-tabs')).toHaveCount(0)
  })

  test('AC-4/AC-7: Klick auf einen Tag legt einen Lehrgang an, der sofort sichtbar ist', async ({ page }) => {
    await login(page, ADMIN.email, ADMIN.password)

    await expect(page.getByTestId('course-calendar')).toBeVisible()

    // Klick auf einen konkreten Tag öffnet die Schnellanlage mit diesem Datum. Das
    // Kalenderraster zeigt volle Wochen um den aktuellen Monat (buildMonthGrid, siehe
    // app/utils/calendar.ts) – je nach Testlauf-Datum kann "heute + 21 Tage" knapp
    // außerhalb dieses Rasters liegen (Monatsgrenze). Dann wie ein echter Nutzer so oft
    // "Nächster Monat" klicken, bis der Zieltag sichtbar ist.
    const tag = isoInDays(21)
    const dayCell = page.getByTestId(`calendar-day-${tag}`)
    for (let attempt = 0; attempt < 2 && !(await dayCell.isVisible()); attempt++) {
      await page.getByTestId('calendar-next').click()
    }
    await dayCell.click()

    await expect(page.getByTestId('course-create-form')).toBeVisible()
    await expect(page.getByTestId('course-start-input')).toHaveValue(tag)

    await fillStable(page.getByTestId('course-title-input'), TITEL)
    await fillStable(page.getByTestId('course-capacity-input'), '8')
    await page.getByTestId('course-create-submit').click()

    await expect(page.getByTestId('course-create-form')).toBeHidden()
    await expect(page.getByTestId('calendar-event').filter({ hasText: TITEL })).toBeVisible()
  })

  test('AC-7: der Gast sieht den neuen Lehrgang in der Übersicht', async ({ page }) => {
    await login(page, GUEST.email, GUEST.password)

    await fillStable(page.getByTestId('course-search'), 'Atemschutz')
    await expect(page.getByTestId('course-card').filter({ hasText: TITEL })).toBeVisible()

    await page.getByTestId('course-card').filter({ hasText: TITEL }).getByTestId('course-details-link').click()
    await expect(page.getByTestId('course-title')).toContainText(TITEL)
    await expect(page.getByTestId('course-facts')).toContainText('0 von 8 Plätzen belegt')
  })

  test('FV-2 AC-4: eine erfolglose Suche zeigt den Leerzustand mit Rücksetzer', async ({ page }) => {
    await login(page, GUEST.email, GUEST.password)

    await fillStable(page.getByTestId('course-search'), 'gibtesnichtxyz')
    await expect(page.getByTestId('course-empty-state')).toBeVisible()

    await page.getByTestId('course-reset-filters').click()
    await expect(page.getByTestId('course-list')).toBeVisible()
  })

  test('FV-2 AC-2: der Kategoriefilter steht in der URL und übersteht ein Neuladen', async ({ page }) => {
    await login(page, GUEST.email, GUEST.password)

    await page.getByTestId('course-filter-atemschutz').click()
    await expect(page).toHaveURL(/kategorie=atemschutz/)

    await page.reload()
    await expect(page.getByTestId('course-filter-atemschutz')).toHaveAttribute('aria-pressed', 'true')
  })

  test('AC-8: die Bearbeitungsseite lädt auch mit zugeordnetem Ausbilder', async ({ page }) => {
    await login(page, ADMIN.email, ADMIN.password)

    const cookie = (await page.context().cookies())
      .map(entry => `${entry.name}=${entry.value}`)
      .join('; ')

    // Regression: ein leerer Auswahlwert ("Ohne Ausbilder") liess die Seite mit 500 abstuerzen.
    const instructor = await (await page.request.post('/api/admin/instructors', {
      headers: { cookie },
      data: { name: 'Brandmeister Regression', role: 'Ausbilder' },
    })).json()

    await page.getByTestId('admin-course-row').filter({ hasText: TITEL }).getByTestId('admin-course-edit').click()
    await expect(page.getByTestId('edit-title')).toBeVisible()

    await page.request.patch(page.url().replace('/verwaltung/lehrgang/', '/api/admin/courses/'), {
      headers: { cookie },
      data: { instructorId: instructor.id },
    })

    await page.reload()
    await expect(page.getByTestId('edit-title')).toBeVisible()
    await expect(page.getByTestId('edit-save')).toBeEnabled()
  })

  test('AC-10: ein abgesagter Lehrgang bleibt sichtbar und ist markiert', async ({ page }) => {
    await login(page, ADMIN.email, ADMIN.password)

    await page.getByTestId('admin-course-row').filter({ hasText: TITEL }).getByTestId('admin-course-edit').click()
    await page.getByTestId('course-cancel-toggle').click()

    await expect(page.getByTestId('course-cancel-toggle')).toContainText('Absage zurücknehmen')

    await login(page, GUEST.email, GUEST.password)
    await fillStable(page.getByTestId('course-search'), 'Atemschutz')
    await expect(
      page.getByTestId('course-card').filter({ hasText: TITEL }).getByTestId('course-cancelled-badge'),
    ).toBeVisible()
  })

  test('FV-6 AC-2/AC-3: die Registratur filtert und entscheidet über eine Anmeldung', async ({ page }) => {
    await login(page, ADMIN.email, ADMIN.password)

    const cookie = (await page.context().cookies())
      .map(eintrag => `${eintrag.name}=${eintrag.value}`)
      .join('; ')

    // Ein eigener Lehrgang mit einer Anmeldung – über die öffentliche Route angelegt.
    const lehrgang = await (await page.request.post('/api/admin/courses', {
      headers: { cookie },
      data: {
        title: 'E2E Registraturlehrgang',
        startsOn: isoInDays(45),
        endsOn: isoInDays(45),
        category: 'atemschutz',
        format: 'kreisausbildung',
        capacity: 5,
      },
    })).json()

    await signInWith(page, GUEST.email, GUEST.password)
    await expect(page).not.toHaveURL(/\/login/)

    // Alle Cookies zusammen – sonst faellt die Sitzung unter den Tisch.
    const gastCookie = (await page.context().cookies())
      .map(eintrag => `${eintrag.name}=${eintrag.value}`)
      .join('; ')

    const angemeldet = await page.request.post(`/api/courses/${lehrgang.id}/signups`, {
      headers: { cookie: gastCookie },
      data: {
        firstName: 'Registratur',
        lastName: 'Testperson',
        email: 'registratur@e2e.local',
        consent: true,
      },
    })
    expect(angemeldet.status(), await angemeldet.text()).toBe(201)

    await login(page, ADMIN.email, ADMIN.password)
    await page.getByRole('tab', { name: 'Registratur' }).click()

    const zeile = page.getByTestId('registry-row').filter({ hasText: 'registratur@e2e.local' })
    await expect(zeile).toBeVisible()

    await zeile.getByTestId('registry-confirm').click()
    await expect(zeile).toContainText('Bestätigt')

    // Filter „Offen" blendet die bestätigte Anmeldung aus und steht in der URL.
    await page.getByTestId('registry-filter-offen').click()
    await expect(page).toHaveURL(/status=offen/)
    await expect(page.getByTestId('registry-row').filter({ hasText: 'registratur@e2e.local' }))
      .toHaveCount(0)

    await page.getByTestId('registry-filter-bestaetigt').click()
    const bestaetigt = page.getByTestId('registry-row').filter({ hasText: 'registratur@e2e.local' })
    await expect(bestaetigt).toBeVisible()

    await bestaetigt.getByTestId('registry-undo').click()
    await expect(page.getByTestId('registry-row').filter({ hasText: 'registratur@e2e.local' }))
      .toHaveCount(0)
  })
})
