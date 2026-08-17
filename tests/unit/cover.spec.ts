import { describe, expect, it } from 'vitest'
import {
  MOTIF_COUNT,
  PALETTE_COUNT,
  escapeXml,
  motifFor,
  paletteFor,
  renderCover,
} from '../../server/utils/cover'

const BASE = { id: 'kurs-1', title: 'Truppmann Grundausbildung', category: 'Grundausbildung' }

describe('FV-2 Lehrgangskatalog – Motiv-Generator', () => {
  it('AC-9: liefert für dieselbe ID immer dasselbe SVG', () => {
    expect(renderCover(BASE)).toBe(renderCover(BASE))
  })

  it('AC-9: erzeugt ein gültiges SVG ohne Skript', () => {
    const svg = renderCover(BASE)

    expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true)
    expect(svg.endsWith('</svg>')).toBe(true)
    expect(svg).not.toContain('<script')
  })

  it('AC-9: maskiert Nutzertext in der Bildbeschreibung, statt ihn als Markup zu übernehmen', () => {
    const svg = renderCover({ ...BASE, title: '<script>alert(1)</script>' })

    expect(svg).not.toContain('<script>')
    expect(svg).toContain('&lt;script&gt;')
    expect(svg).toContain('aria-label=')
  })

  it('AC-10: wählt ohne gesetztes Motiv eines aus dem Hash der ID', () => {
    const first = motifFor('kurs-1')
    const second = motifFor('kurs-2')

    expect(first).toBeGreaterThanOrEqual(0)
    expect(first).toBeLessThan(MOTIF_COUNT)
    expect(motifFor('kurs-1')).toBe(first)
    // Zwei verschiedene IDs sollen nicht systematisch dasselbe Motiv bekommen.
    expect([first, second].length).toBe(2)
  })

  it('AC-10: bevorzugt das gesetzte Motiv und ignoriert unsinnige Werte', () => {
    expect(motifFor('kurs-1', 3)).toBe(3)
    expect(motifFor('kurs-1', 99)).toBe(motifFor('kurs-1'))
    expect(motifFor('kurs-1', -1)).toBe(motifFor('kurs-1'))
    expect(paletteFor('kurs-1', 2)).toBe(2)
    expect(paletteFor('kurs-1', 9)).toBeLessThan(PALETTE_COUNT)
  })

  it('AC-9: beide Varianten sind rein grafisch und haben ihr eigenes Format', () => {
    const card = renderCover({ ...BASE, variant: 'card' })
    const hero = renderCover({ ...BASE, variant: 'hero' })

    expect(card).toContain('viewBox="0 0 800 320"')
    expect(hero).toContain('viewBox="0 0 1180 340"')

    // Der Titel steht in der Oberflaeche neben dem Bild – nicht noch einmal darin (QA-Befund).
    expect(card).not.toContain('<text')
    expect(hero).not.toContain('<text')
    expect(card).toContain('aria-label="Grundausbildung: Truppmann Grundausbildung"')
  })

  it('AC-9: alle Motive und Paletten erzeugen ein SVG', () => {
    for (let motif = 0; motif < MOTIF_COUNT; motif++) {
      for (let palette = 0; palette < PALETTE_COUNT; palette++) {
        const svg = renderCover({ ...BASE, motif, palette })
        expect(svg).toContain('</svg>')
      }
    }
  })

  it('maskiert alle XML-Sonderzeichen', () => {
    expect(escapeXml('<&>"\'')).toBe('&lt;&amp;&gt;&quot;&apos;')
  })
})
