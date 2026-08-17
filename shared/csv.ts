/**
 * CSV fuer Excel (FV-6, AC-7/AC-8).
 *
 * Semikolon als Trennzeichen und ein BOM am Anfang: nur so oeffnet ein deutsches Excel die
 * Datei ohne Nachfrage und stellt Umlaute richtig dar. Reine Funktionen, damit die
 * Maskierung ohne HTTP pruefbar ist.
 */

export const CSV_DELIMITER = ';'
export const CSV_BOM = '\uFEFF'

/** Felder mit Trennzeichen, Anfuehrungszeichen oder Zeilenumbruch werden gequotet. */
export function escapeCsvValue(value: unknown): string {
  if (value === null || value === undefined) return ''

  const text = String(value)
  if (!/[";\n\r]/.test(text)) return text

  return `"${text.replace(/"/g, '""')}"`
}

export function toCsv(header: string[], rows: unknown[][]): string {
  const zeilen = [header, ...rows].map(zeile =>
    zeile.map(escapeCsvValue).join(CSV_DELIMITER),
  )

  return CSV_BOM + zeilen.join('\r\n') + '\r\n'
}
