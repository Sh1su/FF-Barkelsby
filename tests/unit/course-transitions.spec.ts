import { describe, expect, it } from 'vitest'
import { COURSE_TRANSITIONS, canTransition, parseDate } from '../../server/services/course-admin.service'

describe('FV-3 Admin-Kalender – Statusübergänge', () => {
  it('AC-10: ein geplanter Lehrgang kann abgesagt werden', () => {
    expect(canTransition('geplant', 'abgesagt')).toBe(true)
  })

  it('AC-11: eine Absage kann zurückgenommen werden', () => {
    expect(canTransition('abgesagt', 'geplant')).toBe(true)
  })

  it('AC-10: es gibt keine weiteren Zustände', () => {
    expect(Object.keys(COURSE_TRANSITIONS).sort()).toEqual(['abgesagt', 'geplant'])
    expect(canTransition('geplant', 'geplant')).toBe(false)
    expect(canTransition('abgesagt', 'abgesagt')).toBe(false)
  })

  it('liest Datumsangaben ohne lokalen Zeitzonenversatz', () => {
    expect(parseDate('2026-09-11').toISOString()).toBe('2026-09-11T00:00:00.000Z')
  })
})
