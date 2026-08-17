import { describe, expect, it } from 'vitest'
import { CSV_BOM, escapeCsvValue, toCsv } from '../../shared/csv'

describe('FV-6 Registratur – CSV', () => {
  it('AC-7: beginnt mit einem BOM und trennt mit Semikolon', () => {
    const csv = toCsv(['Nachname', 'Vorname'], [['Berger', 'Jonas']])

    // Ausdruecklich der Zeichencode: `startsWith('')` waere immer wahr und haette
    // einen fehlenden BOM nicht bemerkt.
    expect(csv.charCodeAt(0)).toBe(0xFEFF)
    expect(CSV_BOM).toHaveLength(1)
    expect(csv).toContain('Nachname;Vorname')
    expect(csv).toContain('Berger;Jonas')
    expect(csv.endsWith('\r\n')).toBe(true)
  })

  it('AC-8: maskiert Semikolon, Anführungszeichen und Zeilenumbrüche', () => {
    expect(escapeCsvValue('Müller; Sohn')).toBe('"Müller; Sohn"')
    expect(escapeCsvValue('Er sagte "hallo"')).toBe('"Er sagte ""hallo"""')
    expect(escapeCsvValue('Zeile1\nZeile2')).toBe('"Zeile1\nZeile2"')
    expect(escapeCsvValue('harmlos')).toBe('harmlos')
  })

  it('AC-8: leere Werte werden zu leeren Feldern, nicht zu "null"', () => {
    expect(escapeCsvValue(null)).toBe('')
    expect(escapeCsvValue(undefined)).toBe('')
    expect(toCsv(['A', 'B'], [[null, undefined]])).toContain(';')
  })

  it('AC-7: eine Liste ohne Zeilen enthält trotzdem die Kopfzeile', () => {
    const csv = toCsv(['Nachname', 'Vorname'], [])

    expect(csv.slice(1)).toBe('Nachname;Vorname\r\n')
  })
})
