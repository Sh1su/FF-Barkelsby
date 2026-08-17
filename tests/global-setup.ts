import { rmSync } from 'node:fs'
import { resolve } from 'node:path'

/** Frische Testdatenbank vor jedem Lauf – niemals gegen Entwicklungs- oder Produktivdaten testen. */
export default function setup() {
  const dir = resolve('./tests/.tmp')
  rmSync(dir, { recursive: true, force: true })
}
