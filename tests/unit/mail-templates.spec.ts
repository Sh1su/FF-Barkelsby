import { describe, expect, it } from 'vitest'
import {
  DEFAULT_TEMPLATES,
  MAIL_TEMPLATE_KEYS,
  renderCourseCancelled,
  renderCourseRescheduled,
  renderTemplateContent,
} from '../../shared/mail-templates'

const DATA = {
  courseTitle: 'Truppmann Grundausbildung Teil 1',
  dateRange: '22.08. – 24.08.2026',
  organisation: 'Freiwillige Feuerwehr Musterstadt',
  recipientFirstName: 'Jonas',
}

describe('FV-4 E-Mail-Infrastruktur – Vorlagen', () => {
  it('AC-4: die Absage nennt Titel, Zeitraum und Absender', () => {
    const mail = renderCourseCancelled(DATA)

    expect(mail.subject).toBe('Abgesagt: Truppmann Grundausbildung Teil 1')
    expect(mail.text).toContain('Hallo Jonas,')
    expect(mail.text).toContain('Zeitraum: 22.08. – 24.08.2026')
    expect(mail.text).toContain('Freiwillige Feuerwehr Musterstadt')
  })

  it('FV-13, AC-4: enthält keine Uhrzeit- oder Ortsangabe mehr', () => {
    const mail = renderCourseCancelled(DATA)

    expect(mail.text).not.toContain('Uhrzeit:')
    expect(mail.text).not.toContain('Ort:')
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

  it('alle sechs Standardvorlagen rendern mit Titel, Zeitraum und Absender', () => {
    for (const key of MAIL_TEMPLATE_KEYS) {
      const mail = renderTemplateContent(DEFAULT_TEMPLATES[key], {
        ...DATA,
        signupName: 'Jonas Berger',
        signupEmail: 'jonas.berger@example.org',
        cancelUrl: 'https://lehrgaenge.example.org/abmeldung/token',
      })

      expect(mail.subject).toContain('Truppmann Grundausbildung Teil 1')
      expect(mail.text).toContain('Zeitraum: 22.08. – 24.08.2026')
      expect(mail.text).toContain('Freiwillige Feuerwehr Musterstadt')
    }
  })
})

describe('Anpassbare E-Mail-Vorlagen – Platzhalter-Engine', () => {
  it('ersetzt einfache Platzhalter', () => {
    const rendered = renderTemplateContent(
      { subject: 'Betreff {{courseTitle}}', body: 'Text mit {{organisation}}.' },
      { ...DATA },
    )

    expect(rendered.subject).toBe('Betreff Truppmann Grundausbildung Teil 1')
    expect(rendered.text).toBe('Text mit Freiwillige Feuerwehr Musterstadt.')
  })

  it('behält einen {{#if feld}}-Block nur, wenn das Feld gesetzt ist', () => {
    const mitLink = renderTemplateContent(
      { subject: 'Betreff', body: 'Vorher\n{{#if cancelUrl}}Link: {{cancelUrl}}\n{{/if}}Nachher' },
      { ...DATA, cancelUrl: 'https://example.org/abmelden' },
    )
    expect(mitLink.text).toContain('Link: https://example.org/abmelden')

    const ohneLink = renderTemplateContent(
      { subject: 'Betreff', body: 'Vorher\n{{#if cancelUrl}}Link: {{cancelUrl}}\n{{/if}}Nachher' },
      { ...DATA, cancelUrl: undefined },
    )
    expect(ohneLink.text).not.toContain('Link:')
    expect(ohneLink.text).toBe('Vorher\nNachher')
  })

  it('lässt einen unbekannten Platzhalter zu einer leeren Zeichenkette werden', () => {
    const rendered = renderTemplateContent(
      { subject: '{{unbekanntesFeld}}', body: 'x' },
      { ...DATA },
    )
    expect(rendered.subject).toBe('')
  })

  it('reduziert mehrfache Leerzeilen, die durch einen entfernten Block entstehen, auf eine', () => {
    const rendered = renderTemplateContent(
      { subject: 'Betreff', body: 'Erste Zeile\n\n{{#if cancelUrl}}\nLink\n{{/if}}\n\nLetzte Zeile' },
      { ...DATA, cancelUrl: undefined },
    )
    expect(rendered.text).toBe('Erste Zeile\n\nLetzte Zeile')
  })
})
