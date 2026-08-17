import { describe, expect, it } from 'vitest'
import {
  SIGNUP_TRANSITIONS,
  canTransitionSignup,
  templateForStatus,
} from '../../server/services/signup-admin.service'

describe('FV-6 Registratur – Statusübergänge', () => {
  it('AC-3: aus offen führt der Weg zu bestätigt oder abgelehnt', () => {
    expect(canTransitionSignup('offen', 'bestaetigt')).toBe(true)
    expect(canTransitionSignup('offen', 'abgelehnt')).toBe(true)
  })

  it('AC-3: Rückgängig führt aus beiden Endzuständen zurück auf offen', () => {
    expect(canTransitionSignup('bestaetigt', 'offen')).toBe(true)
    expect(canTransitionSignup('abgelehnt', 'offen')).toBe(true)
  })

  it('AC-4: aus einem Storno macht die Verwaltung keine Zusage', () => {
    expect(SIGNUP_TRANSITIONS.storniert).toEqual([])
    expect(canTransitionSignup('storniert', 'bestaetigt')).toBe(false)
    expect(canTransitionSignup('storniert', 'offen')).toBe(false)
  })

  it('AC-4: direkte Sprünge zwischen bestätigt und abgelehnt sind nicht vorgesehen', () => {
    expect(canTransitionSignup('bestaetigt', 'abgelehnt')).toBe(false)
    expect(canTransitionSignup('abgelehnt', 'bestaetigt')).toBe(false)
  })

  it('AC-5: nur Zusage und Absage verschicken eine Mail', () => {
    expect(templateForStatus('bestaetigt')).toBe('anmeldung-bestaetigt')
    expect(templateForStatus('abgelehnt')).toBe('anmeldung-abgelehnt')
    expect(templateForStatus('offen')).toBeNull()
    expect(templateForStatus('storniert')).toBeNull()
  })
})
