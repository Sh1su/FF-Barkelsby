import { expect, test } from '@playwright/test'
import { signIn } from '../e2e/helpers'

/**
 * Layout-Invarianten der Kontenliste (FV-7, QA-Befunde BUG-7-1 und BUG-7-2).
 * Machart wie tests/visual/katalog.layout.spec.ts: Groessen und Ueberlappung statt Pixelvergleich.
 */
const BREAKPOINTS = [
  { name: 'Mobil', width: 375, height: 812 },
  { name: 'Tablet', width: 768, height: 1024 },
  { name: 'Desktop', width: 1440, height: 900 },
]

async function benutzerTab(page: import('@playwright/test').Page) {
  await signIn(page, 'admin')
  await page.goto('/verwaltung')
  await page.getByRole('tab', { name: 'Benutzerverwaltung' }).click()
  await expect(page.getByTestId('user-registry')).toBeVisible()
}

test.describe.serial('FV-7 Benutzerverwaltung – Layout', () => {
  test('AC-1: Bedienelemente der Kontenliste sind auf 375px mindestens 44px hoch', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await benutzerTab(page)

    for (const testid of ['user-new', 'user-password', 'user-kennung', 'user-toggle']) {
      const box = await page.getByTestId(testid).first().boundingBox()
      expect(box, `${testid} fehlt`).not.toBeNull()
      expect(box!.height, `${testid} ist zu klein`).toBeGreaterThanOrEqual(44)
    }
  })

  test('AC-3: auch die Felder im Passwortdialog sind mindestens 44px hoch', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await benutzerTab(page)

    await page.getByTestId('user-password').first().click()

    // Der Dialog faehrt von scale-95 auf scale-100 hoch. `boundingBox()` misst die
    // transformierte Groesse – wer sofort misst, sieht 95 % und faellt faelschlich durch.
    // Deshalb warten, bis der Wert steht, statt einmalig zu messen.
    for (const testid of ['user-password-input', 'user-password-submit']) {
      await expect
        .poll(async () => (await page.getByTestId(testid).boundingBox())?.height ?? 0, {
          message: `${testid} bleibt unter 44px`,
        })
        .toBeGreaterThanOrEqual(44)
    }
  })

  test('AC-10: das Passwortfeld startet verdeckt und lässt sich einblenden', async ({ page }) => {
    await benutzerTab(page)
    await page.getByTestId('user-password').first().click()

    await expect(page.getByTestId('user-password-input')).toHaveAttribute('type', 'password')
    await page.getByTestId('user-password-reveal').click()
    await expect(page.getByTestId('user-password-input')).toHaveAttribute('type', 'text')
  })

  for (const breakpoint of BREAKPOINTS) {
    test(`AC-1: die Kontentabelle bleibt bei ${breakpoint.width}px in ihrem Container`, async ({ page }) => {
      await page.setViewportSize({ width: breakpoint.width, height: breakpoint.height })
      await benutzerTab(page)

      // Die Tabelle darf breiter sein als der Bildschirm – dann scrollt ihr eigener
      // Container. Sie darf aber weder den Abschnitt noch den Bildschirm aufziehen.
      const container = await page.locator('[data-testid="user-registry"] .overflow-x-auto').boundingBox()
      const abschnitt = await page.getByTestId('user-registry').boundingBox()

      expect(container!.width).toBeLessThanOrEqual(abschnitt!.width + 1)
      expect(abschnitt!.width).toBeLessThanOrEqual(breakpoint.width + 1)
    })
  }

  test('AC-1: Zeilen der Kontenliste überlappen einander nicht', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await benutzerTab(page)

    const zeilen = page.getByTestId('user-row')
    const anzahl = await zeilen.count()
    expect(anzahl).toBeGreaterThanOrEqual(2)

    const boxen = []
    for (let index = 0; index < anzahl; index++) {
      boxen.push((await zeilen.nth(index).boundingBox())!)
    }

    for (let a = 0; a < boxen.length; a++) {
      for (let b = a + 1; b < boxen.length; b++) {
        const ueberlappungY = Math.max(
          0,
          Math.min(boxen[a]!.y + boxen[a]!.height, boxen[b]!.y + boxen[b]!.height)
          - Math.max(boxen[a]!.y, boxen[b]!.y),
        )
        expect(ueberlappungY).toBe(0)
      }
    }
  })
})
