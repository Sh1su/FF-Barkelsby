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

/** Format, das der Nuxt-UI-Datumsbereich-Picker anzeigt (de-DE, "medium"). */
function formatiertesDatum(iso: string) {
  const [jahr, monat, tag] = iso.split('-')
  return `${tag}.${monat}.${jahr}`
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

  test('AC-4/AC-7, FV-13 AC-1: Klick auf einen Tag legt einen Lehrgang mit reduzierten Feldern an', async ({ page }) => {
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
    await expect(page.getByTestId('course-date-range-trigger')).toContainText(formatiertesDatum(tag))

    // FV-13, AC-1: Kategorie, Format, Uhrzeit, Ausbilder und Ort fragt das Formular nicht mehr ab.
    // FV-14, AC-1: Plätze ebenfalls nicht mehr.
    const form = page.getByTestId('course-create-form')
    await expect(form.getByText('Kategorie')).toHaveCount(0)
    await expect(form.getByText('Format')).toHaveCount(0)
    await expect(form.getByText('Uhrzeit')).toHaveCount(0)
    await expect(form.getByText('Ausbilder')).toHaveCount(0)
    await expect(form.getByText('Ort', { exact: true })).toHaveCount(0)
    await expect(form.getByText('Plätze')).toHaveCount(0)

    await fillStable(page.getByTestId('course-title-input'), TITEL)
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
    // FV-14, AC-1: keine Platzzahl mehr - die Faktenbox zeigt nur noch Zeitraum und Dauer.
    await expect(page.getByTestId('course-facts')).not.toContainText('Plätzen')
    await expect(page.getByTestId('course-facts')).toContainText('Ein Tag')
  })

  test('FV-2 AC-4: eine erfolglose Suche zeigt den Leerzustand mit Rücksetzer', async ({ page }) => {
    await login(page, GUEST.email, GUEST.password)

    await fillStable(page.getByTestId('course-search'), 'gibtesnichtxyz')
    await expect(page.getByTestId('course-empty-state')).toBeVisible()

    await page.getByTestId('course-reset-filters').click()
    await expect(page.getByTestId('course-list')).toBeVisible()
  })

  test('AC-8, FV-13 AC-2: die Bearbeitungsseite lädt ohne die reduzierten Felder', async ({ page }) => {
    await login(page, ADMIN.email, ADMIN.password)

    await page.getByTestId('admin-course-row').filter({ hasText: TITEL }).getByTestId('admin-course-edit').click()
    await expect(page.getByTestId('edit-title')).toBeVisible()
    await expect(page.getByTestId('edit-save')).toBeEnabled()

    await expect(page.getByText('Kategorie')).toHaveCount(0)
    await expect(page.getByText('Format')).toHaveCount(0)
    await expect(page.getByText('Uhrzeit')).toHaveCount(0)
    await expect(page.getByText('Ausbilder')).toHaveCount(0)
    await expect(page.getByText('Ort', { exact: true })).toHaveCount(0)
    await expect(page.getByText('Plätze')).toHaveCount(0)
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
