// @vitest-environment nuxt
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import CompletionMatrix from '../../app/components/admin/CompletionMatrix.vue'

/**
 * Komponententest zur Admin-Matrix (FV-19). Deckt AC-2 (Tabelle aus AC-1-Daten), AC-6
 * (deaktivierte Konten bleiben sichtbar, aber markiert) und AC-7 (Leerzustand) ab.
 * AC-3/AC-4/AC-5 (Zellen-Klick, horizontales Scrollen) prüft `tests/e2e/05-matrix.spec.ts` –
 * dort lässt sich ein echter Klick-Roundtrip inklusive Layout am ehesten beobachten.
 */

const AKTIVES_MITGLIED = { id: 'mitglied-1', displayName: 'Erika Musterfrau', email: 'erika@test.local', active: true }
const DEAKTIVIERTES_MITGLIED = { id: 'mitglied-2', displayName: 'Max Beispiel', email: 'max@test.local', active: false }

const LEHRGANG_A = { id: 'lehrgang-a', title: 'Truppmann Grundausbildung' }
const LEHRGANG_B = { id: 'lehrgang-b', title: 'Atemschutzgeräteträger' }

let antwort: () => unknown = () => ({
  members: [AKTIVES_MITGLIED, DEAKTIVIERTES_MITGLIED],
  courses: [LEHRGANG_A, LEHRGANG_B],
  completions: { [AKTIVES_MITGLIED.id]: { [LEHRGANG_A.id]: '2024-05-01T00:00:00.000Z' } },
})

registerEndpoint('/api/admin/matrix', () => antwort())

let postAufgerufen = false
let letzteDeleteUrl = ''

registerEndpoint('/api/admin/courses/lehrgang-b/completions', {
  method: 'POST',
  handler: () => {
    postAufgerufen = true
    return { userId: AKTIVES_MITGLIED.id, completedAt: '2026-09-12T00:00:00.000Z' }
  },
})

registerEndpoint('/api/admin/courses/lehrgang-a/completions/mitglied-1', {
  method: 'DELETE',
  handler: () => {
    letzteDeleteUrl = `/api/admin/courses/${LEHRGANG_A.id}/completions/${AKTIVES_MITGLIED.id}`
    return { ok: true }
  },
})

describe('FV-19 Admin-Matrix – CompletionMatrix', () => {
  beforeEach(() => {
    clearNuxtData()
    postAufgerufen = false
    letzteDeleteUrl = ''
    antwort = () => ({
      members: [AKTIVES_MITGLIED, DEAKTIVIERTES_MITGLIED],
      courses: [LEHRGANG_A, LEHRGANG_B],
      completions: { [AKTIVES_MITGLIED.id]: { [LEHRGANG_A.id]: '2024-05-01T00:00:00.000Z' } },
    })
  })

  it('AC-2: zeigt Mitglieder als Zeilen und Lehrgänge als Spalten', async () => {
    const component = await mountSuspended(CompletionMatrix)
    const text = component.text()

    expect(component.findAll('[data-testid="matrix-member-row"]')).toHaveLength(2)
    expect(component.findAll('[data-testid="matrix-course-header"]')).toHaveLength(2)
    expect(text).toContain('Erika Musterfrau')
    expect(text).toContain('Max Beispiel')
    expect(text).toContain('Truppmann Grundausbildung')
    expect(text).toContain('Atemschutzgeräteträger')
  })

  it('AC-2: eine Zelle mit Abschluss zeigt einen Haken, eine ohne nicht', async () => {
    const component = await mountSuspended(CompletionMatrix)
    const ersteZeile = component.findAll('[data-testid="matrix-member-row"]')[0]!

    const zellen = ersteZeile.findAll('[data-testid="matrix-cell"]')
    expect(zellen[0]!.attributes('aria-pressed')).toBe('true')
    expect(zellen[1]!.attributes('aria-pressed')).toBe('false')
  })

  it('AC-6: ein deaktiviertes Konto erscheint weiterhin, aber sichtbar markiert', async () => {
    const component = await mountSuspended(CompletionMatrix)
    const zeilen = component.findAll('[data-testid="matrix-member-row"]')

    expect(zeilen[1]!.text()).toContain('Max Beispiel')
    expect(zeilen[1]!.find('[data-testid="matrix-member-inactive"]').exists()).toBe(true)
    expect(zeilen[0]!.find('[data-testid="matrix-member-inactive"]').exists()).toBe(false)
  })

  it('AC-7: ohne Mitglieder zeigt die Matrix einen Leerzustand statt einer Tabelle', async () => {
    antwort = () => ({ members: [], courses: [LEHRGANG_A], completions: {} })
    const component = await mountSuspended(CompletionMatrix)

    expect(component.find('[data-testid="matrix-empty"]').exists()).toBe(true)
    expect(component.find('table').exists()).toBe(false)
  })

  it('AC-7: ohne Lehrgänge zeigt die Matrix einen Leerzustand statt einer Tabelle', async () => {
    antwort = () => ({ members: [AKTIVES_MITGLIED], courses: [], completions: {} })
    const component = await mountSuspended(CompletionMatrix)

    expect(component.find('[data-testid="matrix-empty"]').exists()).toBe(true)
    expect(component.find('table').exists()).toBe(false)
  })

  it('AC-3: ein Klick auf eine leere Zelle trägt einen Abschluss ein, ohne neu zu laden', async () => {
    const component = await mountSuspended(CompletionMatrix)
    const ersteZeile = component.findAll('[data-testid="matrix-member-row"]')[0]!
    const leereZelle = ersteZeile.findAll('[data-testid="matrix-cell"]')[1]!

    expect(leereZelle.attributes('aria-pressed')).toBe('false')
    await leereZelle.trigger('click')

    await vi.waitFor(() => {
      const aktualisiert = component.findAll('[data-testid="matrix-member-row"]')[0]!
        .findAll('[data-testid="matrix-cell"]')[1]!
      if (aktualisiert.attributes('aria-pressed') !== 'true') throw new Error('noch nicht da')
    })
    expect(postAufgerufen).toBe(true)
  })

  it('AC-4: ein Klick auf eine ausgefüllte Zelle entfernt den Abschluss wieder', async () => {
    const component = await mountSuspended(CompletionMatrix)
    const ersteZeile = component.findAll('[data-testid="matrix-member-row"]')[0]!
    const ausgefuellteZelle = ersteZeile.findAll('[data-testid="matrix-cell"]')[0]!

    expect(ausgefuellteZelle.attributes('aria-pressed')).toBe('true')
    await ausgefuellteZelle.trigger('click')

    await vi.waitFor(() => {
      const aktualisiert = component.findAll('[data-testid="matrix-member-row"]')[0]!
        .findAll('[data-testid="matrix-cell"]')[0]!
      if (aktualisiert.attributes('aria-pressed') !== 'false') throw new Error('noch nicht da')
    })
    expect(letzteDeleteUrl).toBe(`/api/admin/courses/${LEHRGANG_A.id}/completions/${AKTIVES_MITGLIED.id}`)
  })
})
