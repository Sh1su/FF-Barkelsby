import { describe, expect, it } from 'vitest'
import { buildMonthGrid, coversDay, monthLabel, toIsoDate } from '../../app/utils/calendar'

describe('FV-3 Admin-Kalender – Monatsraster', () => {
  it('AC-2: beginnt jede Woche mit Montag', () => {
    // September 2026 beginnt an einem Dienstag.
    const grid = buildMonthGrid(2026, 8, new Date('2026-09-15T12:00:00'))

    expect(grid[0]!.date.getDay()).toBe(1)
    expect(grid.length % 7).toBe(0)
  })

  it('AC-2: enthält den gesamten Monat und markiert Nachbartage', () => {
    const grid = buildMonthGrid(2026, 8, new Date('2026-09-15T12:00:00'))
    const inMonth = grid.filter(day => day.inCurrentMonth)

    expect(inMonth).toHaveLength(30)
    expect(inMonth[0]!.dayOfMonth).toBe(1)
    expect(inMonth.at(-1)!.dayOfMonth).toBe(30)
    expect(grid.some(day => !day.inCurrentMonth)).toBe(true)
  })

  it('AC-2: markiert genau einen Tag als heute', () => {
    const grid = buildMonthGrid(2026, 7, new Date('2026-08-10T12:00:00'))
    const today = grid.filter(day => day.isToday)

    expect(today).toHaveLength(1)
    expect(today[0]!.iso).toBe('2026-08-10')
  })

  it('AC-3: ein mehrtägiger Lehrgang deckt jeden Tag seines Zeitraums ab', () => {
    const course = { startsOn: '2026-09-11T00:00:00Z', endsOn: '2026-09-13T00:00:00Z' }

    expect(coversDay(course, '2026-09-10')).toBe(false)
    expect(coversDay(course, '2026-09-11')).toBe(true)
    expect(coversDay(course, '2026-09-12')).toBe(true)
    expect(coversDay(course, '2026-09-13')).toBe(true)
    expect(coversDay(course, '2026-09-14')).toBe(false)
  })

  it('AC-2: beschriftet den Monat auf Deutsch', () => {
    expect(monthLabel(2026, 8)).toBe('September 2026')
  })

  it('formatiert Datumswerte ohne Zeitzonenversatz', () => {
    expect(toIsoDate(new Date(2026, 0, 5))).toBe('2026-01-05')
  })
})
