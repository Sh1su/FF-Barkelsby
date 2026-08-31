import { test } from '@playwright/test'
import { fillStable, signIn } from '../e2e/helpers'

/**
 * Kein Testlauf im eigentlichen Sinn, sondern die Bildstrecke fuer die QA:
 * legt Demo-Lehrgaenge an und fotografiert jede Seite in Desktop- und Handybreite.
 * Wird ueber playwright.qa.config.ts gestartet, nicht ueber `npm run test:e2e`.
 */

const DEMO = [
  {
    title: 'Truppmann Grundausbildung Teil 1',
    summary: 'Basisausbildung für alle neuen Einsatzkräfte der Wehr.',
    description: 'Der Lehrgang vermittelt die Grundlagen des Feuerwehrdienstes: Rechtsgrundlagen, Fahrzeug- und Gerätekunde, Löschtechnik sowie das Verhalten an der Einsatzstelle.',
    topics: ['Rechtsgrundlagen', 'Fahrzeugkunde', 'Löschmittel und Löschtechnik', 'Verhalten an der Einsatzstelle'],
    offset: 12,
    days: 3,
    timeLabel: '18:30 – 21:00',
    motif: 0,
  },
  {
    title: 'Atemschutzgeräteträger Fortbildung',
    summary: 'Jährliche Pflichtunterweisung inklusive Belastungsübung.',
    description: 'Auffrischung der Atemschutzausbildung mit praktischer Belastungsübung in der Atemschutzstrecke.',
    topics: ['Gerätekunde', 'Belastungsübung', 'Notfallrettung'],
    offset: 21,
    days: 1,
    timeLabel: '08:00 – 16:00',
    motif: 1,
  },
  {
    title: 'Technische Hilfeleistung bei Verkehrsunfällen',
    summary: 'Rettungsgeräte, Patientenschonende Rettung, Absicherung.',
    offset: 28,
    days: 2,
    timeLabel: '09:00 – 17:00',
    motif: 5,
  },
  {
    title: 'Gruppenführer Fortbildung',
    summary: 'Einsatztaktik, Führungsvorgang und Kommunikation.',
    offset: 35,
    days: 2,
    timeLabel: '08:30 – 16:30',
    motif: 6,
  },
  {
    title: 'Erste Hilfe Auffrischung',
    summary: 'Herz-Lungen-Wiederbelebung und Einsatz des AED.',
    offset: 42,
    days: 1,
    timeLabel: '19:00 – 22:00',
    motif: 3,
  },
  {
    title: 'Maschinist für Löschfahrzeuge',
    summary: 'Pumpenkunde, Wasserförderung und Fahrzeugtechnik.',
    offset: 56,
    days: 3,
    timeLabel: '08:00 – 17:00',
    motif: 2,
  },
]

function isoInDays(days: number) {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date.toISOString().slice(0, 10)
}

const SHOTS = process.env.QA_SHOT_DIR ?? 'qa-screenshots'

test('Bildstrecke für die QA', async ({ page }) => {
  test.setTimeout(180_000)

  await signIn(page, 'admin')
  const cookie = (await page.context().cookies())
    .map(entry => `${entry.name}=${entry.value}`)
    .join('; ')

  let firstCourseId = ''

  for (const demo of DEMO) {
    const created = await (await page.request.post('/api/admin/courses', {
      headers: { cookie },
      data: {
        title: demo.title,
        startsOn: isoInDays(demo.offset),
        endsOn: isoInDays(demo.offset + demo.days - 1),
        motif: demo.motif,
      },
    })).json()

    firstCourseId ||= created.id

    await page.request.patch(`/api/admin/courses/${created.id}`, {
      headers: { cookie },
      data: {
        summary: demo.summary,
        description: demo.description,
        topics: demo.topics,
        days: Array.from({ length: demo.days }, (_, index) => ({
          dayNumber: index + 1,
          date: isoInDays(demo.offset + index),
          timeLabel: demo.timeLabel,
          title: index === 0 ? 'Theorie und Einweisung' : `Praxisteil ${index}`,
          bullets: index === 0 ? ['Organisatorisches', 'Rechtsgrundlagen'] : ['Übung in Gruppen'],
        })),
      },
    })
  }

  // Eine Anmeldung erzeugen, damit Formular und Registratur etwas zu zeigen haben.
  await signIn(page, 'guest')
  await page.goto(`/lehrgang/${firstCourseId}`)
  await page.getByTestId('course-signup-button').click()
  await page.waitForTimeout(500)
  await page.screenshot({ path: `${SHOTS}/13-anmeldeformular.png` })

  await fillStable(page.getByTestId('signup-firstname'), 'Jonas')
  await fillStable(page.getByTestId('signup-lastname'), 'Berger')
  await fillStable(page.getByTestId('signup-email'), 'jonas.berger@example.org')
  await page.getByTestId('signup-consent').click()
  await page.getByTestId('signup-submit').click()
  await page.waitForTimeout(600)
  await page.screenshot({ path: `${SHOTS}/14-anmeldung-bestaetigung.png` })

  await signIn(page, 'admin')
  await page.goto('/verwaltung')
  await page.getByRole('tab', { name: 'Registratur' }).click()
  await page.waitForTimeout(600)
  await page.screenshot({ path: `${SHOTS}/15-registratur.png`, fullPage: true })

  await page.emulateMedia({ colorScheme: 'dark' })
  await page.reload()
  await page.getByRole('tab', { name: 'Registratur' }).click()
  await page.waitForTimeout(600)
  await page.screenshot({ path: `${SHOTS}/16-dunkel-registratur.png`, fullPage: true })
  await page.emulateMedia({ colorScheme: 'light' })

  // Dunkler Modus: derselbe Ausschnitt zum Vergleich
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.goto('/verwaltung')
  await page.waitForTimeout(600)
  await page.screenshot({ path: `${SHOTS}/10-dunkel-verwaltung.png`, fullPage: true })

  await page.goto(`/verwaltung/lehrgang/${firstCourseId}`)
  await page.waitForTimeout(600)
  await page.screenshot({ path: `${SHOTS}/11-dunkel-bearbeiten.png`, fullPage: true })

  await signIn(page, 'guest')
  await page.waitForTimeout(600)
  await page.screenshot({ path: `${SHOTS}/09-dunkel-uebersicht.png`, fullPage: true })

  await page.goto(`/lehrgang/${firstCourseId}`)
  await page.waitForTimeout(600)
  await page.screenshot({ path: `${SHOTS}/12-dunkel-detail.png`, fullPage: true })

  await page.emulateMedia({ colorScheme: 'light' })
  await signIn(page, 'admin')

  // Verwaltung
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('/verwaltung')
  await page.waitForTimeout(600)
  await page.screenshot({ path: `${SHOTS}/05-verwaltung-kalender.png`, fullPage: true })

  await page.goto(`/verwaltung/lehrgang/${firstCourseId}`)
  await page.waitForTimeout(600)
  await page.screenshot({ path: `${SHOTS}/06-verwaltung-bearbeiten.png`, fullPage: true })

  // Anmeldedialog
  await page.goto('/verwaltung')
  await page.getByTestId('admin-new-course').click()
  await page.waitForTimeout(800)
  await page.screenshot({ path: `${SHOTS}/07-verwaltung-schnellanlage.png` })

  // Gast-Ansicht
  await signIn(page, 'guest')
  await page.waitForTimeout(600)
  await page.screenshot({ path: `${SHOTS}/02-uebersicht-desktop.png`, fullPage: true })

  await page.goto(`/lehrgang/${firstCourseId}`)
  await page.waitForTimeout(600)
  await page.screenshot({ path: `${SHOTS}/03-detailseite-desktop.png`, fullPage: true })

  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto('/')
  await page.waitForTimeout(600)
  await page.screenshot({ path: `${SHOTS}/04-uebersicht-mobil.png`, fullPage: true })

  // Leerzustand
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('/')
  await fillStable(page.getByTestId('course-search'), 'gibtesnichtxyz')
  await page.waitForTimeout(600)
  await page.screenshot({ path: `${SHOTS}/08-leerzustand.png` })

  // Anmeldeseite
  await page.getByTestId('logout-button').click()
  await page.waitForURL(/\/login/)
  await page.waitForTimeout(400)
  await page.screenshot({ path: `${SHOTS}/01-login.png` })
})
