import { describe, expect, it } from 'vitest'
import { freeSeats, isFullyBooked } from '../../server/services/course.service'

describe('FV-2 Lehrgangskatalog – Belegung', () => {
  it('AC-6: ausgebucht ist ein Lehrgang erst, wenn die bestätigten Anmeldungen die Plätze erreichen', () => {
    expect(isFullyBooked(10, 9)).toBe(false)
    expect(isFullyBooked(10, 10)).toBe(true)
    expect(isFullyBooked(10, 11)).toBe(true)
  })

  it('AC-6: freie Plätze werden nie negativ', () => {
    expect(freeSeats(10, 3)).toBe(7)
    expect(freeSeats(10, 14)).toBe(0)
  })
})
