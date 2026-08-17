import { expect, test } from '@playwright/test'
import { fillStable, signIn } from '../e2e/helpers'

/**
 * Layout-Invarianten statt Pixelvergleich (.claude/rules/testing.md):
 * geprueft werden Position, Ueberlappung, Scrollverhalten und Groesse der Bedienelemente.
 */
const BREAKPOINTS = [
  { name: 'Mobil', width: 375, height: 812 },
  { name: 'Tablet', width: 768, height: 1024 },
  { name: 'Desktop', width: 1440, height: 900 },
]

test.describe.serial('FV-2 Lehrgangskatalog – Layout', () => {
  for (const breakpoint of BREAKPOINTS) {
    test(`AC-12: die Übersicht scrollt bei ${breakpoint.width}px nicht horizontal`, async ({ page }) => {
      await page.setViewportSize({ width: breakpoint.width, height: breakpoint.height })
      await signIn(page, 'guest')

      await expect(page.getByRole('heading', { name: 'Aktuelle Lehrgänge' })).toBeVisible()

      const overflow = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }))

      expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 1)
    })
  }

  test('AC-12: Bedienelemente sind auf 375px mindestens 44px hoch', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await signIn(page, 'guest')

    const search = await page.getByTestId('course-search').boundingBox()
    const filter = await page.getByTestId('course-filter-alle').boundingBox()

    expect(search!.height).toBeGreaterThanOrEqual(44)
    expect(filter!.height).toBeGreaterThanOrEqual(44)
  })

  test('AC-12: Karten überlappen einander nicht', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })

    // Für den Überlappungstest braucht es mehrere Karten – als Admin anlegen.
    await signIn(page, 'admin')

    // Das Session-Cookie ist im Produktionsbuild `secure`; der API-Kontext von Playwright
    // schickt es nicht automatisch mit, deshalb setzen wir es hier ausdrücklich.
    const cookieHeader = (await page.context().cookies())
      .map(cookie => `${cookie.name}=${cookie.value}`)
      .join('; ')

    for (const [index, titel] of ['Layouttest Eins', 'Layouttest Zwei', 'Layouttest Drei'].entries()) {
      const start = new Date()
      start.setDate(start.getDate() + 50 + index)
      const iso = start.toISOString().slice(0, 10)
      const response = await page.request.post('/api/admin/courses', {
        headers: { cookie: cookieHeader },
        data: {
          title: titel,
          startsOn: iso,
          endsOn: iso,
          category: 'grundausbildung',
          format: 'standortausbildung',
        },
      })
      expect(response.status(), await response.text()).toBe(201)
    }

    await signIn(page, 'guest')
    await fillStable(page.getByTestId('course-search'), 'Layouttest')

    const cards = page.getByTestId('course-card')
    await expect(cards).toHaveCount(3)
    const count = await cards.count()

    const boxes = []
    for (let index = 0; index < count; index++) {
      boxes.push((await cards.nth(index).boundingBox())!)
    }

    for (let a = 0; a < boxes.length; a++) {
      for (let b = a + 1; b < boxes.length; b++) {
        const overlapX = Math.max(0, Math.min(boxes[a]!.x + boxes[a]!.width, boxes[b]!.x + boxes[b]!.width) - Math.max(boxes[a]!.x, boxes[b]!.x))
        const overlapY = Math.max(0, Math.min(boxes[a]!.y + boxes[a]!.height, boxes[b]!.y + boxes[b]!.height) - Math.max(boxes[a]!.y, boxes[b]!.y))
        expect(overlapX * overlapY).toBe(0)
      }
    }
  })
})
