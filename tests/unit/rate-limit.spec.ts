import { beforeEach, describe, expect, it } from 'vitest'
import { LOGIN_RATE_LIMIT } from '../../shared/constants'
import {
  _clearRateLimits,
  checkRateLimit,
  recordFailure,
  resetRateLimit,
} from '../../server/utils/rate-limit'

const NOW = new Date('2026-08-10T12:00:00Z').getTime()

describe('FV-1 Fundament & Login-Gate – Rate Limit', () => {
  beforeEach(() => {
    _clearRateLimits()
  })

  it('AC-5: erlaubt zehn Fehlversuche und sperrt den elften', () => {
    for (let attempt = 0; attempt < LOGIN_RATE_LIMIT.maxAttempts; attempt++) {
      expect(checkRateLimit('1.2.3.4', NOW).allowed).toBe(true)
      recordFailure('1.2.3.4', NOW)
    }

    const blocked = checkRateLimit('1.2.3.4', NOW)
    expect(blocked.allowed).toBe(false)
    expect(blocked.retryAfterSeconds).toBe(LOGIN_RATE_LIMIT.windowMs / 1000)
  })

  it('AC-5: gibt nach Ablauf des Zeitfensters wieder frei', () => {
    for (let attempt = 0; attempt < LOGIN_RATE_LIMIT.maxAttempts; attempt++) {
      recordFailure('1.2.3.4', NOW)
    }
    expect(checkRateLimit('1.2.3.4', NOW).allowed).toBe(false)

    const later = NOW + LOGIN_RATE_LIMIT.windowMs + 1000
    expect(checkRateLimit('1.2.3.4', later).allowed).toBe(true)
  })

  it('AC-5: ein erfolgreicher Login setzt den Zähler zurück', () => {
    for (let attempt = 0; attempt < LOGIN_RATE_LIMIT.maxAttempts; attempt++) {
      recordFailure('1.2.3.4', NOW)
    }
    resetRateLimit('1.2.3.4')

    expect(checkRateLimit('1.2.3.4', NOW).allowed).toBe(true)
  })

  it('AC-6: zählt pro IP, nicht pro Konto – andere IPs bleiben frei', () => {
    for (let attempt = 0; attempt < LOGIN_RATE_LIMIT.maxAttempts; attempt++) {
      recordFailure('1.2.3.4', NOW)
    }

    expect(checkRateLimit('1.2.3.4', NOW).allowed).toBe(false)
    expect(checkRateLimit('5.6.7.8', NOW).allowed).toBe(true)
  })
})
