import { describe, expect, it } from 'vitest'
import { darfDeaktivieren } from '../../server/services/user-admin.service'

describe('FV-7 Benutzerverwaltung – Schutzregeln', () => {
  it('AC-7, FV-15 AC-4: ein Mitgliedskonto lässt sich abschalten – keine Sonderrolle mehr', () => {
    // Bis FV-15 galt hier ein Sonderfall fuer das eine geteilte Gast-Konto. Seit
    // persoenliche Mitgliedskonten das ersetzen, greift nur noch die
    // Admin-Mindestzahl-Regel – ein Mitgliedskonto zaehlt dafuer ohnehin nicht mit.
    expect(darfDeaktivieren({ role: 'member' }, 5).erlaubt).toBe(true)
    expect(darfDeaktivieren({ role: 'member' }, 0).erlaubt).toBe(true)
  })

  it('AC-6: der letzte aktive Admin bleibt aktiv', () => {
    const regel = darfDeaktivieren({ role: 'admin' }, 1)

    expect(regel.erlaubt).toBe(false)
    expect(regel.grund).toContain('letzte aktive Verwaltungskonto')
  })

  it('AC-6: mit einer Vertretung darf ein Admin deaktiviert werden', () => {
    expect(darfDeaktivieren({ role: 'admin' }, 2).erlaubt).toBe(true)
  })

  it('AC-6: auch bei null aktiven Admins wird nicht weiter deaktiviert', () => {
    expect(darfDeaktivieren({ role: 'admin' }, 0).erlaubt).toBe(false)
  })
})
