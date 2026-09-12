import { describe, expect, it } from 'vitest'
import { canReach } from '../../server/services/course-prerequisites.service'

/**
 * FV-17 Lehrgangs-Voraussetzungen – Zyklus-Erkennung als reine Funktion, ohne Datenbank
 * (Tech Design: `canReach` bekommt die Kanten explizit als Map, kein `useDatabase`-Zugriff).
 */
describe('FV-17 Lehrgangs-Voraussetzungen – Zyklus-Erkennung', () => {
  it('AC-2: ein Lehrgang, der sich selbst voraussetzen würde, gilt als erreicht (Zyklus)', () => {
    const edges = new Map<string, string[]>()
    expect(canReach(edges, 'a', 'a')).toBe(true)
  })

  it('AC-5: erkennt den direkten Zyklus (B verlangt bereits A, A soll neu B verlangen)', () => {
    // B --> A (bestehende Kante). Neue Kante A --> B würde einen Zyklus schließen:
    // kann das vorgeschlagene B (von A aus gesehen) A erreichen? Ja, direkt.
    const edges = new Map([['b', ['a']]])
    expect(canReach(edges, 'b', 'a')).toBe(true)
  })

  it('AC-5: erkennt einen Zyklus über drei Stationen (A→B, B→C, C soll A verlangen)', () => {
    const edges = new Map([
      ['a', ['b']],
      ['b', ['c']],
    ])
    // C soll A als Voraussetzung bekommen (C --> A). Kann A (das vorgeschlagene) C erreichen?
    expect(canReach(edges, 'a', 'c')).toBe(true)
  })

  it('kein Zyklus bei unabhängigen Lehrgängen ohne gemeinsame Kante', () => {
    const edges = new Map([['b', ['c']]])
    expect(canReach(edges, 'b', 'a')).toBe(false)
  })

  it('kein Zyklus, wenn die Kette in die andere Richtung läuft', () => {
    const edges = new Map([['a', ['b']]])
    expect(canReach(edges, 'b', 'a')).toBe(false)
  })
})
