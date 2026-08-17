import { expect, test, type Page } from '@playwright/test'
import { signIn } from '../e2e/helpers'

/**
 * Prueft den Farbmodus als Verhalten, nicht als Bildvergleich: Systemvorgabe, Umschalter,
 * Kontrast und Erkennbarkeit der Eingabefelder (.claude/rules/testing.md).
 */

/** Relative Leuchtdichte nach WCAG. */
function luminanz([r, g, b]: number[]): number {
  const kanal = (wert: number) => {
    const anteil = wert! / 255
    return anteil <= 0.03928 ? anteil / 12.92 : ((anteil + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * kanal(r!) + 0.7152 * kanal(g!) + 0.0722 * kanal(b!)
}

function kontrast(vordergrund: number[], hintergrund: number[]): number {
  const hell = Math.max(luminanz(vordergrund), luminanz(hintergrund))
  const dunkel = Math.min(luminanz(vordergrund), luminanz(hintergrund))
  return (hell + 0.05) / (dunkel + 0.05)
}

async function farbwerte(page: Page, selektor: string) {
  // Erst warten, bis das Element wirklich da ist – nach der Anmeldung laeuft noch eine Navigation.
  await page.locator(selektor).first().waitFor({ state: 'visible' })

  return page.evaluate((sel) => {
    const parse = (wert: string) => wert.match(/\d+(\.\d+)?/g)?.slice(0, 3).map(Number) ?? [0, 0, 0]

    const element = document.querySelector(sel)!
    const stil = getComputedStyle(element)

    // Den ersten Vorfahren mit gedecktem Hintergrund suchen.
    let hintergrund = 'rgba(0, 0, 0, 0)'
    let knoten: Element | null = element
    while (knoten && (hintergrund === 'rgba(0, 0, 0, 0)' || hintergrund === 'transparent')) {
      hintergrund = getComputedStyle(knoten).backgroundColor
      knoten = knoten.parentElement
    }

    return {
      text: parse(stil.color),
      hintergrund: parse(hintergrund),
      eigenerHintergrund: parse(stil.backgroundColor),
      rahmenBreite: Number.parseFloat(stil.borderTopWidth),
      // Nuxt UI umrandet Eingabefelder mit einem Ring (box-shadow), nicht mit border.
      ring: stil.boxShadow,
      colorScheme: getComputedStyle(document.documentElement).colorScheme,
    }
  }, selektor)
}

test.describe.serial('FV-11 Farbmodus', () => {
  test('AC-1: ohne eigene Wahl folgt die Anwendung der Systemeinstellung', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' })
    await signIn(page, 'guest')
    await expect(page.locator('html')).toHaveClass(/dark/)

    await page.emulateMedia({ colorScheme: 'light' })
    await page.reload()
    await expect(page.locator('html')).not.toHaveClass(/dark/)
  })

  test('AC-2/AC-6: der Umschalter wechselt den Modus und merkt sich die Wahl', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' })
    await signIn(page, 'guest')

    const umschalter = page.getByTestId('color-mode-toggle')
    await expect(umschalter).toBeVisible()
    await expect(umschalter).toHaveAttribute('aria-label', /dunklen Ansicht/)

    await umschalter.click()
    await expect(page.locator('html')).toHaveClass(/dark/)

    // Wahl übersteht Seitenwechsel und Neuladen, obwohl das System hell bleibt.
    await page.goto('/')
    await expect(page.locator('html')).toHaveClass(/dark/)
    await page.reload()
    await expect(page.locator('html')).toHaveClass(/dark/)

    await umschalter.click()
    await expect(page.locator('html')).not.toHaveClass(/dark/)
  })

  test('AC-7: der Umschalter steht schon auf der Anmeldeseite bereit', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByTestId('color-mode-toggle')).toBeVisible()
  })

  for (const modus of ['light', 'dark'] as const) {
    test(`AC-3: Fließtext hat im Modus ${modus} ausreichenden Kontrast`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: modus })
      await signIn(page, 'guest')

      // Bewusst Elemente, die es auch ohne Lehrgänge gibt – so haengt der Test nicht an Daten.
      const ueberschrift = await farbwerte(page, 'h1')
      const beschreibung = await farbwerte(page, '[data-testid="course-result-label"]')

      expect(kontrast(ueberschrift.text, ueberschrift.hintergrund)).toBeGreaterThanOrEqual(4.5)
      expect(kontrast(beschreibung.text, beschreibung.hintergrund)).toBeGreaterThanOrEqual(4.5)
    })

    test(`AC-4/AC-5: Eingabefelder sind im Modus ${modus} erkennbar`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: modus })
      await signIn(page, 'guest')

      const feld = await farbwerte(page, '[data-testid="course-search"]')
      const seite = await farbwerte(page, 'body')

      // Der Text im Feld muss lesbar sein …
      expect(kontrast(feld.text, feld.eigenerHintergrund)).toBeGreaterThanOrEqual(4.5)

      // … und das Feld muss als Feld erkennbar sein: entweder durch eine Umrandung
      // (Nuxt UI nutzt dafuer einen Ring statt border) oder durch eine eigene Flaeche.
      const umrandet = feld.rahmenBreite > 0 || (feld.ring !== 'none' && feld.ring !== '')
      const eigeneFlaeche = kontrast(feld.eigenerHintergrund, seite.eigenerHintergrund) > 1.05
      expect(umrandet || eigeneFlaeche).toBe(true)

      // Native Bedienelemente folgen dem Modus.
      expect(feld.colorScheme).toBe(modus)
    })
  }
})
