import { describe, expect, it } from 'vitest'
import { renderCourseCancelled, renderCourseRescheduled } from '../../shared/mail-templates'

const DATA = {
  courseTitle: 'Truppmann Grundausbildung Teil 1',
  dateRange: '22.08. – 24.08.2026',
  timeLabel: '18:30 – 21:00',
  location: 'Gerätehaus Musterstadt',
  organisation: 'Freiwillige Feuerwehr Musterstadt',
  recipientFirstName: 'Jonas',
}

describe('FV-4 E-Mail-Infrastruktur – Vorlagen', () => {
  it('AC-4: die Absage nennt Titel, Zeitraum, Uhrzeit, Ort und Absender', () => {
    const mail = renderCourseCancelled(DATA)

    expect(mail.subject).toBe('Abgesagt: Truppmann Grundausbildung Teil 1')
    expect(mail.text).toContain('Hallo Jonas,')
    expect(mail.text).toContain('Zeitraum: 22.08. – 24.08.2026')
    expect(mail.text).toContain('Uhrzeit: 18:30 – 21:00')
    expect(mail.text).toContain('Ort: Gerätehaus Musterstadt')
    expect(mail.text).toContain('Freiwillige Feuerwehr Musterstadt')
  })

  it('AC-4: die Terminänderung nennt den neuen und den bisherigen Zeitraum', () => {
    const mail = renderCourseRescheduled({ ...DATA, previousDateRange: '01.08. – 03.08.2026' })

    expect(mail.subject).toBe('Neuer Termin: Truppmann Grundausbildung Teil 1')
    expect(mail.text).toContain('Zeitraum: 22.08. – 24.08.2026')
    expect(mail.text).toContain('Bisheriger Zeitraum: 01.08. – 03.08.2026')
  })

  it('AC-4: ohne Vornamen bleibt die Anrede allgemein', () => {
    const mail = renderCourseCancelled({ ...DATA, recipientFirstName: '  ' })

    expect(mail.text.startsWith('Hallo,')).toBe(true)
  })

  it('AC-4: fehlende Angaben werden weggelassen statt leer gedruckt', () => {
    const mail = renderCourseCancelled({ ...DATA, timeLabel: null, location: null })

    expect(mail.text).not.toContain('Uhrzeit:')
    expect(mail.text).not.toContain('Ort:')
    expect(mail.text).toContain('Zeitraum:')
  })
})
