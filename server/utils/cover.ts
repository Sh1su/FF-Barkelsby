/**
 * Serverseitig erzeugte Titelbilder (FV-2, AC-9/AC-10).
 *
 * Es gibt bewusst keine Bilddateien und keine Uploads (PRD, Q7): jedes Motiv ist eine
 * reine Funktion, die einen SVG-String liefert. Damit gibt es nichts zu speichern,
 * nichts zusaetzlich zu sichern und keine toten Bildpfade nach einem Restore.
 *
 * Zwei Formate: Karte 800x320 und Hero 1180x340 – beide rein grafisch. Titel und
 * Kategorie stehen in der Oberflaeche direkt neben dem Bild und werden nicht hineingeschrieben.
 */

export const MOTIF_COUNT = 8
export const PALETTE_COUNT = 4

export interface Palette {
  background: string
  accent: string
  muted: string
}

export const PALETTES: Palette[] = [
  { background: '#131C2C', accent: '#C1121F', muted: 'rgba(255,255,255,.26)' },
  { background: '#141D2D', accent: '#E34455', muted: 'rgba(255,255,255,.22)' },
  { background: '#1E2A3D', accent: '#C1121F', muted: 'rgba(255,255,255,.30)' },
  { background: '#0F1723', accent: '#F0737F', muted: 'rgba(255,255,255,.20)' },
]

export type CoverVariant = 'card' | 'hero'

export interface CoverInput {
  id: string
  title: string
  /** Wird fuer die Bildbeschreibung genutzt, nicht mehr ins Bild geschrieben. */
  category: string
  subtitle?: string
  motif?: number | null
  palette?: number | null
  variant?: CoverVariant
}

const DIMENSIONS: Record<CoverVariant, { width: number, height: number }> = {
  card: { width: 800, height: 320 },
  hero: { width: 1180, height: 340 },
}

/** FNV-1a: kurz, stabil und ohne Abhaengigkeit – gleiche ID ergibt immer dasselbe Bild. */
export function hashString(value: string): number {
  let hash = 0x811c9dc5
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash >>> 0
}

export function motifFor(id: string, motif?: number | null): number {
  if (typeof motif === 'number' && Number.isInteger(motif) && motif >= 0 && motif < MOTIF_COUNT) {
    return motif
  }
  return hashString(id) % MOTIF_COUNT
}

export function paletteFor(id: string, palette?: number | null): number {
  if (
    typeof palette === 'number'
    && Number.isInteger(palette)
    && palette >= 0
    && palette < PALETTE_COUNT
  ) {
    return palette
  }
  return (hashString(`${id}-palette`) >>> 3) % PALETTE_COUNT
}

/** Nutzertexte landen im SVG – daher konsequent escapen (kein `<script>`, keine Attribut-Ausbrueche). */
export function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

type MotifRenderer = (width: number, height: number, palette: Palette) => string

const MOTIFS: MotifRenderer[] = [
  // 0 – Sparren (Dachlinien), Vorlage aus dem Design
  (width, height, palette) => {
    const parts: string[] = []
    // Zwei ruhige Reihen statt eines dichten Musters – der Entwurf laesst viel Flaeche frei.
    const rows = Math.max(2, Math.round(height / 170))
    const step = height / rows

    for (let row = 0; row < rows; row++) {
      const baseline = step * (row + 1) - 12
      const peak = baseline - step * 0.62
      for (let index = 0; index < Math.ceil(width / 100) + 1; index++) {
        const x = -30 + index * 100
        const stroke = (index + row) % 3 === 0 ? palette.accent : palette.muted
        parts.push(
          `<path d="M${x} ${baseline.toFixed(0)} L${x + 54} ${peak.toFixed(0)} L${x + 108} ${baseline.toFixed(0)}" fill="none" stroke="${stroke}" stroke-width="14" stroke-linejoin="round"/>`,
        )
      }
    }
    return parts.join('')
  },

  // 1 – konzentrische Kreise
  (width, height, palette) => {
    const cx = width / 2
    const cy = height / 2
    const unit = height / 2.2
    return [1, 0.77, 0.55, 0.33]
      .map((factor, index) =>
        `<circle cx="${cx}" cy="${cy}" r="${(unit * factor).toFixed(0)}" fill="none" stroke="${index === 1 ? palette.accent : palette.muted}" stroke-width="${index === 1 ? 15 : 8}"/>`,
      )
      .join('') + `<circle cx="${cx}" cy="${cy}" r="${(unit * 0.12).toFixed(0)}" fill="rgba(255,255,255,.9)"/>`
  },

  // 2 – Raster
  (width, height, palette) => {
    const parts: string[] = []
    for (let x = 60; x < width; x += 80) {
      parts.push(`<path d="M${x} 0 V${height}" stroke="${palette.muted}" stroke-width="4"/>`)
    }
    for (let y = 60; y < height; y += 80) {
      parts.push(`<path d="M0 ${y} H${width}" stroke="${palette.muted}" stroke-width="4"/>`)
    }
    parts.push(
      `<rect x="60" y="60" width="160" height="80" fill="none" stroke="${palette.accent}" stroke-width="12"/>`,
    )
    return parts.join('')
  },

  // 3 – Wellen
  (width, height, palette) => {
    const parts: string[] = []
    const lines = Math.max(4, Math.round(height / 70))
    for (let index = 0; index < lines; index++) {
      const y = (height / (lines + 1)) * (index + 1)
      const stroke = index === 1 ? palette.accent : palette.muted
      const segments: string[] = [`M0 ${y}`]
      for (let x = 0; x < width; x += 120) {
        segments.push(`q 30 -26 60 0 t 60 0`)
      }
      parts.push(
        `<path d="${segments.join(' ')}" fill="none" stroke="${stroke}" stroke-width="${index === 1 ? 12 : 7}" stroke-linecap="round"/>`,
      )
    }
    return parts.join('')
  },

  // 4 – Diagonalen
  (width, height, palette) => {
    const parts: string[] = []
    for (let x = -height; x < width; x += 64) {
      const stroke = x % 192 === 0 ? palette.accent : palette.muted
      parts.push(
        `<path d="M${x} ${height} L${x + height} 0" stroke="${stroke}" stroke-width="10" stroke-linecap="round"/>`,
      )
    }
    return parts.join('')
  },

  // 5 – Schlauchbogen
  (width, height, palette) => {
    const baseline = height - 60
    return [
      `<path d="M60 ${baseline} Q${width / 2} ${baseline - 220} ${width - 60} ${baseline}" fill="none" stroke="${palette.accent}" stroke-width="16" stroke-linecap="round"/>`,
      `<path d="M120 ${baseline} Q${width / 2} ${baseline - 150} ${width - 120} ${baseline}" fill="none" stroke="${palette.muted}" stroke-width="10" stroke-linecap="round"/>`,
      `<path d="M40 ${baseline} H${width - 40}" stroke="rgba(255,255,255,.12)" stroke-width="8"/>`,
    ].join('')
  },

  // 6 – Leiter
  (width, height, palette) => {
    const parts = [
      `<path d="M${width / 2 - 90} ${height} L${width / 2 - 40} 20" stroke="${palette.accent}" stroke-width="14" stroke-linecap="round"/>`,
      `<path d="M${width / 2 + 90} ${height} L${width / 2 + 40} 20" stroke="${palette.accent}" stroke-width="14" stroke-linecap="round"/>`,
    ]
    for (let index = 0; index < 6; index++) {
      const y = 50 + index * 48
      const shrink = index * 8
      parts.push(
        `<path d="M${width / 2 - 82 + shrink} ${y} H${width / 2 + 82 - shrink}" stroke="${palette.muted}" stroke-width="9" stroke-linecap="round"/>`,
      )
    }
    return parts.join('')
  },

  // 7 – Punktmatrix
  (width, height, palette) => {
    const parts: string[] = []
    for (let x = 50; x < width; x += 56) {
      for (let y = 40; y < height; y += 56) {
        const highlight = (x + y) % 224 === 0
        parts.push(
          `<circle cx="${x}" cy="${y}" r="${highlight ? 12 : 6}" fill="${highlight ? palette.accent : palette.muted}"/>`,
        )
      }
    }
    return parts.join('')
  },
]

/** Erzeugt das Titelbild als SVG-String. */
export function renderCover(input: CoverInput): string {
  const variant = input.variant ?? 'card'
  const { width, height } = DIMENSIONS[variant]
  const palette = PALETTES[paletteFor(input.id, input.palette)]!
  const motif = MOTIFS[motifFor(input.id, input.motif)]!

  const body = [
    `<rect width="${width}" height="${height}" fill="${palette.background}"/>`,
    `<g opacity=".9" clip-path="url(#clip)">${motif(width, height, palette)}</g>`,
  ]

  // Bewusst ohne Textband: Titel, Kategorie und Ausbilder stehen direkt neben dem Bild.
  // Im Entwurf ersetzte der Text ein fehlendes Foto – in der Anwendung waere er doppelt.
  // Der Titel bleibt als aria-label erhalten, damit Screenreader das Bild einordnen koennen.

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="${escapeXml(`${input.category}: ${input.title}`)}">`,
    `<defs><clipPath id="clip"><rect width="${width}" height="${height}"/></clipPath></defs>`,
    body.join(''),
    '</svg>',
  ].join('')
}
