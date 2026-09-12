import { expect, test } from '@playwright/test'
import { signIn } from './helpers'

/**
 * FV-19 Admin-Matrix: Zellen-Klick (AC-3/AC-4) und horizontales Scrollverhalten (AC-5).
 * Bewusst nur Abschluss-Status – keine Berechtigungs-/Voraussetzungs-Auswertung, siehe
 * "Scope-Entscheidung" in features/FV-19-admin-matrix.md.
 */

const TITEL = 'E2E Matrix Lehrgang'
const MITGLIED_NAME = 'E2E Matrix Mitglied'
const MITGLIED_EMAIL = 'matrix-mitglied-e2e@e2e.local'

function isoInDays(days: number) {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date.toISOString().slice(0, 10)
}

async function matrixTab(page: import('@playwright/test').Page) {
  await signIn(page, 'admin')
  await page.goto('/verwaltung')
  await oeffneMatrixTab(page)
}

// Der Tab-Zustand ist reine Komponenten-Ref, keine URL – nach jedem `page.reload()` startet
// die Verwaltung wieder auf "Kalender" und der Matrix-Tab muss erneut angeklickt werden.
async function oeffneMatrixTab(page: import('@playwright/test').Page) {
  await page.getByRole('tab', { name: 'Matrix' }).click()
  await expect(page.getByTestId('completion-matrix')).toBeVisible()
}

/** Findet den Spaltenindex eines Lehrgangs anhand seines Titels in den Kopfzeilen. */
async function spaltenIndex(page: import('@playwright/test').Page, titel: string) {
  const titles = await page.getByTestId('matrix-course-header').allTextContents()
  const index = titles.findIndex(text => text.trim() === titel)
  expect(index, `Spalte "${titel}" nicht gefunden`).toBeGreaterThanOrEqual(0)
  return index
}

test.describe.serial('FV-19 Admin-Matrix', () => {
  test('AC-3/AC-4: ein Klick trägt einen Abschluss ein, ein weiterer entfernt ihn wieder', async ({ page }) => {
    await signIn(page, 'admin')

    const cookie = (await page.context().cookies())
      .map(eintrag => `${eintrag.name}=${eintrag.value}`)
      .join('; ')

    const lehrgangResponse = await page.request.post('/api/admin/courses', {
      headers: { cookie },
      data: { title: TITEL, startsOn: isoInDays(90), endsOn: isoInDays(90) },
    })
    expect(lehrgangResponse.status(), await lehrgangResponse.text()).toBe(201)

    const mitgliedResponse = await page.request.post('/api/admin/members', {
      headers: { cookie },
      data: { email: MITGLIED_EMAIL, displayName: MITGLIED_NAME },
    })
    expect(mitgliedResponse.status(), await mitgliedResponse.text()).toBe(201)

    await page.goto('/verwaltung')
    await oeffneMatrixTab(page)

    const zeile = page.getByTestId('matrix-member-row').filter({ hasText: MITGLIED_NAME })
    await expect(zeile).toBeVisible()

    const spalte = await spaltenIndex(page, TITEL)
    const zelle = zeile.getByTestId('matrix-cell').nth(spalte)

    // AC-3: leere Zelle -> Klick trägt einen Abschluss ein, ohne die Matrix neu zu laden.
    await expect(zelle).toHaveAttribute('aria-pressed', 'false')
    await zelle.click()
    await expect(zelle).toHaveAttribute('aria-pressed', 'true')

    // Ein Neuladen bestätigt, dass der Abschluss wirklich serverseitig ankam (nicht nur lokal).
    await page.reload()
    await oeffneMatrixTab(page)
    const zeileNachReload = page.getByTestId('matrix-member-row').filter({ hasText: MITGLIED_NAME })
    const spalteNachReload = await spaltenIndex(page, TITEL)
    const zelleNachReload = zeileNachReload.getByTestId('matrix-cell').nth(spalteNachReload)
    await expect(zelleNachReload).toHaveAttribute('aria-pressed', 'true')

    // AC-4: ausgefüllte Zelle -> Klick entfernt den Abschluss wieder.
    await zelleNachReload.click()
    await expect(zelleNachReload).toHaveAttribute('aria-pressed', 'false')

    await page.reload()
    await oeffneMatrixTab(page)
    const zeileFinal = page.getByTestId('matrix-member-row').filter({ hasText: MITGLIED_NAME })
    const spalteFinal = await spaltenIndex(page, TITEL)
    await expect(zeileFinal.getByTestId('matrix-cell').nth(spalteFinal)).toHaveAttribute('aria-pressed', 'false')
  })

  // Bewusst kein Vergleich gegen `document.documentElement.scrollWidth`: `/verwaltung` hat
  // unabhängig vom gewählten Tab ein bekanntes, nicht der Matrix zuzurechnendes Überbreite-
  // Problem der Tab-Leiste selbst (441px statt 375px, siehe features/INDEX.md, FV-7-QA-Fund
  // "gehört zu FV-3"). AC-5 verlangt, dass die Matrix-Tabelle *ihren eigenen* Container nicht
  // sprengt – genau das prüfen die folgenden Tests, exakt wie
  // tests/visual/verwaltung.layout.spec.ts es für `UserRegistry.vue` bereits tut.
  for (const breakpoint of [{ width: 375, height: 812 }, { width: 768, height: 1024 }, { width: 1440, height: 900 }]) {
    test(`AC-5: die Matrix-Tabelle bleibt bei ${breakpoint.width}px in ihrem Container`, async ({ page }) => {
      await page.setViewportSize(breakpoint)
      await matrixTab(page)

      const container = await page.locator('[data-testid="completion-matrix"] .overflow-x-auto').boundingBox()
      const abschnitt = await page.getByTestId('completion-matrix').boundingBox()

      expect(container!.width).toBeLessThanOrEqual(abschnitt!.width + 1)
      expect(abschnitt!.width).toBeLessThanOrEqual(breakpoint.width + 1)
    })
  }
})
