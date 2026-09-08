/**
 * Vorlagen fuer die E-Mails (FV-4), jetzt ueber die Verwaltung anpassbar.
 *
 * Reine Funktionen ohne Seiteneffekte: kein Datenbankzugriff, kein Versand. Damit sind sie
 * direkt testbar und der Wortlaut laesst sich pruefen, ohne einen Mailserver zu starten.
 * Nur Text, kein HTML – ein Feuerwehr-Verteiler liest das ohnehin am Telefon.
 *
 * Format: `{{feld}}` wird durch den jeweiligen Wert ersetzt, `{{#if feld}}…{{/if}}` behaelt den
 * eingeschlossenen Text nur, wenn das Feld gesetzt ist (leere Felder gelten als nicht gesetzt).
 * `server/services/mail-templates.service.ts` liest die – ggf. in der Verwaltung angepasste –
 * Vorlage aus der Datenbank und faellt ohne eigene Version auf `DEFAULT_TEMPLATES` zurueck.
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
  organisation: string
  recipientFirstName: string
  /** Nur bei Verschiebung: der bisherige Zeitraum. */
  previousDateRange?: string
}

export interface RenderedMail {
  subject: string
  text: string
}

/** Betreff und Text einer Vorlage – so liegt sie in der Datenbank und im Editor. */
export interface MailTemplateContent {
  subject: string
  body: string
}

function greeting(firstName: string): string {
  return firstName.trim() ? `Hallo ${firstName.trim()},` : 'Hallo,'
}

const CONDITIONAL_BLOCK = /\{\{#if (\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g
const PLACEHOLDER = /\{\{(\w+)\}\}/g

/**
 * Ersetzt `{{feld}}` und wertet `{{#if feld}}…{{/if}}`-Bloecke aus. Mehrfache Leerzeilen, die
 * durch einen entfernten Block entstehen koennen, werden auf eine einzige reduziert – der
 * Wortlaut selbst bleibt vollstaendig in der Hand dessen, der die Vorlage schreibt.
 */
function fillTemplate(raw: string, fields: Record<string, string>): string {
  const withConditions = raw.replace(
    CONDITIONAL_BLOCK,
    (_match, key: string, inner: string) => (fields[key] ? inner : ''),
  )
  const substituted = withConditions.replace(
    PLACEHOLDER,
    (_match, key: string) => fields[key] ?? '',
  )
  return substituted.replace(/\n{3,}/g, '\n\n').trim()
}

/** Rendert eine Vorlage (Standard oder aus der Verwaltung angepasst) mit den Lehrgangsdaten. */
export function renderTemplateContent(content: MailTemplateContent, data: CourseMailData): RenderedMail {
  const fields: Record<string, string> = {
    courseTitle: data.courseTitle,
    dateRange: data.dateRange,
    organisation: data.organisation,
    recipientFirstName: data.recipientFirstName,
    cancelUrl: data.cancelUrl ?? '',
    previousDateRange: data.previousDateRange ?? '',
    signupName: data.signupName ?? 'unbekannt',
    signupEmail: data.signupEmail ?? '',
    greeting: greeting(data.recipientFirstName),
  }

  return {
    subject: fillTemplate(content.subject, fields),
    text: fillTemplate(content.body, fields),
  }
}

export const DEFAULT_TEMPLATES: Record<MailTemplate, MailTemplateContent> = {
  'lehrgang-abgesagt': {
    subject: 'Abgesagt: {{courseTitle}}',
    body: `{{greeting}}

der folgende Lehrgang muss leider abgesagt werden:

Lehrgang: {{courseTitle}}
Zeitraum: {{dateRange}}

Eine Anmeldung ist damit hinfällig. Sobald ein Ersatztermin feststeht, wird er in der
Lehrgangsübersicht veröffentlicht.

Viele Grüße
{{organisation}}`,
  },
  'lehrgang-verschoben': {
    subject: 'Neuer Termin: {{courseTitle}}',
    body: `{{greeting}}

der Termin des folgenden Lehrgangs hat sich geändert:

Lehrgang: {{courseTitle}}
Zeitraum: {{dateRange}}
{{#if previousDateRange}}Bisheriger Zeitraum: {{previousDateRange}}
{{/if}}
Bitte prüfen Sie, ob der neue Termin für Sie passt. Wenn nicht, melden Sie sich bitte
bei der Wehrführung.

Viele Grüße
{{organisation}}`,
  },
  'anmeldung-eingegangen': {
    subject: 'Anmeldung eingegangen: {{courseTitle}}',
    body: `{{greeting}}

Ihre Interessensbekundung ist eingegangen:

Lehrgang: {{courseTitle}}
Zeitraum: {{dateRange}}

Die Wehrführung prüft die Anmeldung und meldet sich, sobald Ihr Platz feststeht.
{{#if cancelUrl}}
Wenn Sie doch nicht können, melden Sie sich hier wieder ab:
{{cancelUrl}}
{{/if}}
Viele Grüße
{{organisation}}`,
  },
  'anmeldung-neu': {
    subject: 'Neue Anmeldung: {{courseTitle}}',
    body: `Hallo,

für den folgenden Lehrgang liegt eine neue Interessensbekundung vor:

Lehrgang: {{courseTitle}}
Zeitraum: {{dateRange}}

Interessent: {{signupName}}{{#if signupEmail}} ({{signupEmail}}){{/if}}

Die Anmeldung wartet in der Registratur auf Bestätigung.

Viele Grüße
{{organisation}}`,
  },
  'anmeldung-bestaetigt': {
    subject: 'Zusage: {{courseTitle}}',
    body: `{{greeting}}

Ihr Platz ist bestätigt:

Lehrgang: {{courseTitle}}
Zeitraum: {{dateRange}}

Bitte seien Sie pünktlich vor Ort.
{{#if cancelUrl}}
Falls Sie doch nicht können, melden Sie sich bitte hier ab:
{{cancelUrl}}
{{/if}}
Viele Grüße
{{organisation}}`,
  },
  'anmeldung-abgelehnt': {
    subject: 'Absage: {{courseTitle}}',
    body: `{{greeting}}

für den folgenden Lehrgang konnte Ihnen leider kein Platz zugeteilt werden:

Lehrgang: {{courseTitle}}
Zeitraum: {{dateRange}}

Bei der nächsten Ausschreibung sind Sie gern wieder dabei – die Übersicht zeigt alle
kommenden Termine.

Viele Grüße
{{organisation}}`,
  },
}

export const MAIL_TEMPLATE_KEYS = Object.keys(DEFAULT_TEMPLATES) as MailTemplate[]

/** Verfuegbare Platzhalter je Vorlage – fuer den Editor in der Verwaltung. */
export const TEMPLATE_FIELDS: Record<MailTemplate, string[]> = {
  'lehrgang-abgesagt': ['greeting', 'courseTitle', 'dateRange', 'organisation'],
  'lehrgang-verschoben': ['greeting', 'courseTitle', 'dateRange', 'previousDateRange', 'organisation'],
  'anmeldung-eingegangen': ['greeting', 'courseTitle', 'dateRange', 'cancelUrl', 'organisation'],
  'anmeldung-neu': ['courseTitle', 'dateRange', 'signupName', 'signupEmail', 'organisation'],
  'anmeldung-bestaetigt': ['greeting', 'courseTitle', 'dateRange', 'cancelUrl', 'organisation'],
  'anmeldung-abgelehnt': ['greeting', 'courseTitle', 'dateRange', 'organisation'],
}

/** Kurzbeschreibung je Vorlage – fuer die Liste im Editor. */
export const TEMPLATE_LABELS: Record<MailTemplate, string> = {
  'lehrgang-abgesagt': 'Lehrgang abgesagt',
  'lehrgang-verschoben': 'Lehrgang verschoben',
  'anmeldung-eingegangen': 'Anmeldung eingegangen (an Interessent)',
  'anmeldung-neu': 'Neue Anmeldung (an Wehrführung)',
  'anmeldung-bestaetigt': 'Zusage',
  'anmeldung-abgelehnt': 'Absage',
}

function renderDefault(template: MailTemplate, data: CourseMailData): RenderedMail {
  return renderTemplateContent(DEFAULT_TEMPLATES[template], data)
}

export function renderCourseCancelled(data: CourseMailData): RenderedMail {
  return renderDefault('lehrgang-abgesagt', data)
}

export function renderCourseRescheduled(data: CourseMailData): RenderedMail {
  return renderDefault('lehrgang-verschoben', data)
}

/** Eingangsbestaetigung an den Interessenten (FV-5, AC-7). */
export function renderSignupReceived(data: CourseMailData): RenderedMail {
  return renderDefault('anmeldung-eingegangen', data)
}

/** Hinweis an die Wehrfuehrung, dass etwas in der Registratur liegt (FV-5, AC-7). */
export function renderSignupNotice(data: CourseMailData): RenderedMail {
  return renderDefault('anmeldung-neu', data)
}

/** Zusage an den Interessenten (FV-6, AC-5). */
export function renderSignupConfirmed(data: CourseMailData): RenderedMail {
  return renderDefault('anmeldung-bestaetigt', data)
}

/** Absage einer einzelnen Anmeldung (FV-6, AC-5). */
export function renderSignupRejected(data: CourseMailData): RenderedMail {
  return renderDefault('anmeldung-abgelehnt', data)
}

export const TEMPLATES: Record<MailTemplate, (data: CourseMailData) => RenderedMail> = {
  'lehrgang-abgesagt': renderCourseCancelled,
  'lehrgang-verschoben': renderCourseRescheduled,
  'anmeldung-eingegangen': renderSignupReceived,
  'anmeldung-neu': renderSignupNotice,
  'anmeldung-bestaetigt': renderSignupConfirmed,
  'anmeldung-abgelehnt': renderSignupRejected,
}
