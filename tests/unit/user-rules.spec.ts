import { describe, expect, it } from 'vitest'
import { darfDeaktivieren } from '../../server/services/user-admin.service'

describe('FV-7 Benutzerverwaltung – Schutzregeln', () => {
  it('AC-7: der Gast-Zugang lässt sich nie abschalten', () => {
    const regel = darfDeaktivieren({ role: 'guest' }, 5)

    expect(regel.erlaubt).toBe(false)
    expect(regel.grund).toContain('Gast-Zugang')
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
