// @vitest-environment nuxt
import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import CourseCard from '../../app/components/courses/CourseCard.vue'

const BASE = {
  id: 'kurs-1',
  title: 'Truppmann Grundausbildung',
  summary: 'Grundlagen für neue Einsatzkräfte.',
  startsOn: '2026-09-11T00:00:00.000Z',
  endsOn: '2026-09-13T00:00:00.000Z',
  confirmedCount: 3,
  signupOpen: true,
  status: 'geplant' as const,
}

describe('FV-2 Lehrgangskatalog – CourseCard', () => {
  it('AC-5: zeigt Titel, Zeitraum und Anmeldungen', async () => {
    const component = await mountSuspended(CourseCard, { props: { course: BASE } })
    const text = component.text()

    expect(text).toContain('Truppmann Grundausbildung')
    expect(text).toContain('3 Anmeldungen bestätigt')
    expect(component.find('[data-testid="course-date-badge"]').text()).toContain('11')
  })

  it('FV-13, AC-3: zeigt kein Format-/Kategorie-Badge mehr', async () => {
    const component = await mountSuspended(CourseCard, { props: { course: BASE } })

    expect(component.text()).not.toContain('Standortausbildung')
    expect(component.text()).not.toContain('Oberbrandmeisterin')
  })

  it('FV-14, AC-1: zeigt keine Platzzahl mehr', async () => {
    const component = await mountSuspended(CourseCard, {
      props: { course: { ...BASE, confirmedCount: 0 } },
    })

    expect(component.find('[data-testid="course-signups"]').exists()).toBe(false)
    expect(component.text()).not.toContain('Plätzen')
  })

  it('AC-5: bindet das generierte Titelbild ein statt einer Bilddatei', async () => {
    const component = await mountSuspended(CourseCard, { props: { course: BASE } })

    expect(component.find('img').attributes('src')).toBe('/api/courses/kurs-1/cover.svg')
  })

  it('FV-14, AC-4: zeigt das Badge "Anmeldung geschlossen", wenn der Lehrgang schon begonnen hat', async () => {
    const component = await mountSuspended(CourseCard, {
      props: { course: { ...BASE, signupOpen: false } },
    })

    expect(component.find('[data-testid="course-closed-badge"]').exists()).toBe(true)
    expect(component.text()).toContain('Anmeldung geschlossen')
  })

  it('AC-7: markiert einen abgesagten Lehrgang', async () => {
    const component = await mountSuspended(CourseCard, {
      props: { course: { ...BASE, status: 'abgesagt' as const, signupOpen: false } },
    })

    expect(component.find('[data-testid="course-cancelled-badge"]').exists()).toBe(true)
    expect(component.find('[data-testid="course-closed-badge"]').exists()).toBe(false)
  })

  it('AC-5: verlinkt auf die Detailseite', async () => {
    const component = await mountSuspended(CourseCard, { props: { course: BASE } })

    expect(component.html()).toContain('/lehrgang/kurs-1')
  })
})
