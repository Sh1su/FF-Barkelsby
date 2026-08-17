import { expect, test } from '@playwright/test'
import { fillStable, signIn } from './helpers'

/** Der Weg aus dem Entwurf: Detailseite → drei Felder → Bestätigung (FV-5, AC-1/AC-4). */
const TITEL = 'E2E Anmeldelehrgang'

function isoInDays(days: number) {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date.toISOString().slice(0, 10)
}

test.describe.serial('FV-5 Interessensbekundung', () => {
  let lehrgangId = ''

  test.beforeAll(async ({ browser }) => {
    const seite = await browser.newPage()
    await signIn(seite, 'admin')

    const cookie = (await seite.context().cookies())
      .map(eintrag => `${eintrag.name}=${eintrag.value}`)
      .join('; ')

    const angelegt = await (await seite.request.post('/api/admin/courses', {
      headers: { cookie },
      data: {
        title: TITEL,
        startsOn: isoInDays(30),
        endsOn: isoInDays(30),
        category: 'erste-hilfe',
        format: 'standortausbildung',
        capacity: 4,
      },
    })).json()

    lehrgangId = angelegt.id
    await seite.close()
  })

  test('AC-1: drei Felder plus Einwilligung, dann Bestätigung', async ({ page }) => {
    await signIn(page, 'guest')
    await page.goto(`/lehrgang/${lehrgangId}`)

    await page.getByTestId('course-signup-button').click()
    await expect(page.getByTestId('signup-form')).toBeVisible()

    await fillStable(page.getByTestId('signup-firstname'), 'Jonas')
    await fillStable(page.getByTestId('signup-lastname'), 'Berger')
    await fillStable(page.getByTestId('signup-email'), 'jonas.berger@e2e.local')

    // Ohne Einwilligung darf nichts gespeichert werden.
    await page.getByTestId('signup-submit').click()
    await expect(page.getByTestId('signup-done')).toHaveCount(0)

    await page.getByTestId('signup-consent').click()
    await page.getByTestId('signup-submit').click()

    await expect(page.getByTestId('signup-done')).toBeVisible()
    await expect(page.getByTestId('signup-done')).toContainText(TITEL)

    await page.getByTestId('signup-close').click()
    await expect(page.getByTestId('signup-form')).toHaveCount(0)
  })

  test('AC-4: dieselbe Adresse wird beim zweiten Mal abgewiesen', async ({ page }) => {
    await signIn(page, 'guest')
    await page.goto(`/lehrgang/${lehrgangId}`)

    await page.getByTestId('course-signup-button').click()
    await fillStable(page.getByTestId('signup-firstname'), 'Jonas')
    await fillStable(page.getByTestId('signup-lastname'), 'Berger')
    await fillStable(page.getByTestId('signup-email'), 'jonas.berger@e2e.local')
    await page.getByTestId('signup-consent').click()
    await page.getByTestId('signup-submit').click()

    await expect(page.getByTestId('signup-error')).toContainText('bereits eine Anmeldung')
  })

  test('AC-1: die Datenschutzseite ist ohne Anmeldung erreichbar', async ({ page }) => {
    await page.context().clearCookies()
    await page.goto('/datenschutz')

    await expect(page.getByRole('heading', { name: 'Datenschutz' })).toBeVisible()
  })
})
