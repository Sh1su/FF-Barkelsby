// @vitest-environment nuxt
import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import CourseCard from '../../app/components/courses/CourseCard.vue'

const BASE = {
  id: 'kurs-1',
  title: 'Truppmann Grundausbildung',
  summary: 'Grundlagen für neue Einsatzkräfte.',
  category: 'grundausbildung' as const,
  format: 'standortausbildung' as const,
  startsOn: '2026-09-11T00:00:00.000Z',
  endsOn: '2026-09-13T00:00:00.000Z',
  timeLabel: '18:30 – 21:00',
  location: 'Gerätehaus',
  capacity: 12,
  confirmedCount: 3,
  fullyBooked: false,
  status: 'geplant' as const,
  instructorName: 'Oberbrandmeisterin Vogt',
}

describe('FV-2 Lehrgangskatalog – CourseCard', () => {
  it('AC-5: zeigt Kategorie, Format, Titel, Zeitraum, Ausbilder und Belegung', async () => {
    const component = await mountSuspended(CourseCard, { props: { course: BASE } })
    const text = component.text()

    expect(text).toContain('Grundausbildung')
    expect(text).toContain('Standortausbildung')
    expect(text).toContain('Truppmann Grundausbildung')
    expect(text).toContain('Oberbrandmeisterin Vogt')
    expect(text).toContain('3 von 12 Plätzen belegt')
    expect(component.find('[data-testid="course-date-badge"]').text()).toContain('11')
  })

  it('AC-5: bindet das generierte Titelbild ein statt einer Bilddatei', async () => {
    const component = await mountSuspended(CourseCard, { props: { course: BASE } })

    expect(component.find('img').attributes('src')).toBe('/api/courses/kurs-1/cover.svg')
  })

  it('AC-6: zeigt das Badge "Ausgebucht", wenn alle Plätze bestätigt belegt sind', async () => {
    const component = await mountSuspended(CourseCard, {
      props: { course: { ...BASE, confirmedCount: 12, fullyBooked: true } },
    })

    expect(component.find('[data-testid="course-full-badge"]').exists()).toBe(true)
    expect(component.text()).toContain('12 von 12 Plätzen belegt')
  })

  it('AC-6: ohne Kapazitätsgrenze gibt es kein Ausgebucht-Badge', async () => {
    const component = await mountSuspended(CourseCard, {
      props: { course: { ...BASE, capacity: 0, confirmedCount: 40, fullyBooked: false } },
    })

    expect(component.find('[data-testid="course-full-badge"]').exists()).toBe(false)
    expect(component.text()).toContain('Plätze nach Absprache')
  })

  it('AC-7: markiert einen abgesagten Lehrgang', async () => {
    const component = await mountSuspended(CourseCard, {
      props: { course: { ...BASE, status: 'abgesagt' as const } },
    })

    expect(component.find('[data-testid="course-cancelled-badge"]').exists()).toBe(true)
    expect(component.find('[data-testid="course-full-badge"]').exists()).toBe(false)
  })

  it('AC-5: verlinkt auf die Detailseite', async () => {
    const component = await mountSuspended(CourseCard, { props: { course: BASE } })

    expect(component.html()).toContain('/lehrgang/kurs-1')
  })
})
