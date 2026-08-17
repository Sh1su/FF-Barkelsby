/**
 * Vorlagen fuer die E-Mails (FV-4).
 *
 * Reine Funktionen ohne Seiteneffekte: kein Datenbankzugriff, kein Versand. Damit sind sie
 * direkt testbar und der Wortlaut laesst sich pruefen, ohne einen Mailserver zu starten.
 * Nur Text, kein HTML – ein Feuerwehr-Verteiler liest das ohnehin am Telefon.
 */

export type MailTemplate =
  | 'lehrgang-abgesagt'
  | 'lehrgang-verschoben'
  | 'anmeldung-eingegangen'
  | 'anmeldung-neu'
  | 'anmeldung-bestaetigt'
  | 'anmeldung-abgelehnt'

export interface CourseMailData {
  /** Vollstaendiger Abmelde-Link mit Zufallstoken (FV-5, AC-7). */
  cancelUrl?: string
  /** Nur fuer die Benachrichtigung an die Wehrfuehrung. */
  signupName?: string
  signupEmail?: string
  courseTitle: string
  /** Bereits formatierter Zeitraum, z. B. "22.08. – 24.08.2026". */
  dateRange: string
  timeLabel?: string | null
  location?: string | null
  organisation: string
  recipientFirstName: string
  /** Nur bei Verschiebung: der bisherige Zeitraum. */
  previousDateRange?: string
}

export interface RenderedMail {
  subject: string
  text: string
}

function greeting(firstName: string): string {
  return firstName.trim() ? `Hallo ${firstName.trim()},` : 'Hallo,'
}

function courseFacts(data: CourseMailData): string {
  const lines = [`Lehrgang: ${data.courseTitle}`, `Zeitraum: ${data.dateRange}`]
  if (data.timeLabel) lines.push(`Uhrzeit: ${data.timeLabel}`)
  if (data.location) lines.push(`Ort: ${data.location}`)
  return lines.join('\n')
}

export function renderCourseCancelled(data: CourseMailData): RenderedMail {
  return {
    subject: `Abgesagt: ${data.courseTitle}`,
    text: [
      greeting(data.recipientFirstName),
      '',
      `der folgende Lehrgang muss leider abgesagt werden:`,
      '',
      courseFacts(data),
      '',
      'Eine Anmeldung ist damit hinfällig. Sobald ein Ersatztermin feststeht, wird er in der',
      'Lehrgangsübersicht veröffentlicht.',
      '',
      'Viele Grüße',
      data.organisation,
    ].join('\n'),
  }
}

export function renderCourseRescheduled(data: CourseMailData): RenderedMail {
  return {
    subject: `Neuer Termin: ${data.courseTitle}`,
    text: [
      greeting(data.recipientFirstName),
      '',
      'der Termin des folgenden Lehrgangs hat sich geändert:',
      '',
      courseFacts(data),
      data.previousDateRange ? `Bisheriger Zeitraum: ${data.previousDateRange}` : '',
      '',
      'Bitte prüfen Sie, ob der neue Termin für Sie passt. Wenn nicht, melden Sie sich bitte',
      'bei der Wehrführung.',
      '',
      'Viele Grüße',
      data.organisation,
    ]
      .filter(line => line !== '')
      .join('\n')
      .replace(/\n(Bitte prüfen)/, '\n\n$1')
      .replace(/\n(Viele Grüße)/, '\n\n$1'),
  }
}

/** Eingangsbestaetigung an den Interessenten (FV-5, AC-7). */
export function renderSignupReceived(data: CourseMailData): RenderedMail {
  return {
    subject: `Anmeldung eingegangen: ${data.courseTitle}`,
    text: [
      greeting(data.recipientFirstName),
      '',
      'Ihre Interessensbekundung ist eingegangen:',
      '',
      courseFacts(data),
      '',
      'Die Wehrführung prüft die Anmeldung und meldet sich, sobald Ihr Platz feststeht.',
      ...(data.cancelUrl
        ? ['', 'Wenn Sie doch nicht können, melden Sie sich hier wieder ab:', data.cancelUrl]
        : []),
      '',
      'Viele Grüße',
      data.organisation,
    ].join('\n'),
  }
}

/** Hinweis an die Wehrfuehrung, dass etwas in der Registratur liegt (FV-5, AC-7). */
export function renderSignupNotice(data: CourseMailData): RenderedMail {
  return {
    subject: `Neue Anmeldung: ${data.courseTitle}`,
    text: [
      'Hallo,',
      '',
      'für den folgenden Lehrgang liegt eine neue Interessensbekundung vor:',
      '',
      courseFacts(data),
      '',
      `Interessent: ${data.signupName ?? 'unbekannt'}${data.signupEmail ? ` (${data.signupEmail})` : ''}`,
      '',
      'Die Anmeldung wartet in der Registratur auf Bestätigung.',
      '',
      'Viele Grüße',
      data.organisation,
    ].join('\n'),
  }
}

/** Zusage an den Interessenten (FV-6, AC-5). */
export function renderSignupConfirmed(data: CourseMailData): RenderedMail {
  return {
    subject: `Zusage: ${data.courseTitle}`,
    text: [
      greeting(data.recipientFirstName),
      '',
      'Ihr Platz ist bestätigt:',
      '',
      courseFacts(data),
      '',
      'Bitte seien Sie pünktlich vor Ort.',
      ...(data.cancelUrl
        ? ['', 'Falls Sie doch nicht können, melden Sie sich bitte hier ab:', data.cancelUrl]
        : []),
      '',
      'Viele Grüße',
      data.organisation,
    ].join('\n'),
  }
}

/** Absage einer einzelnen Anmeldung (FV-6, AC-5). */
export function renderSignupRejected(data: CourseMailData): RenderedMail {
  return {
    subject: `Absage: ${data.courseTitle}`,
    text: [
      greeting(data.recipientFirstName),
      '',
      'für den folgenden Lehrgang konnte Ihnen leider kein Platz zugeteilt werden:',
      '',
      courseFacts(data),
      '',
      'Bei der nächsten Ausschreibung sind Sie gern wieder dabei – die Übersicht zeigt alle',
      'kommenden Termine.',
      '',
      'Viele Grüße',
      data.organisation,
    ].join('\n'),
  }
}

export const TEMPLATES: Record<MailTemplate, (data: CourseMailData) => RenderedMail> = {
  'lehrgang-abgesagt': renderCourseCancelled,
  'lehrgang-verschoben': renderCourseRescheduled,
  'anmeldung-eingegangen': renderSignupReceived,
  'anmeldung-neu': renderSignupNotice,
  'anmeldung-bestaetigt': renderSignupConfirmed,
  'anmeldung-abgelehnt': renderSignupRejected,
}
