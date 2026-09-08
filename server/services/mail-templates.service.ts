import { eq } from 'drizzle-orm'
import type { CourseMailData, MailTemplate, MailTemplateContent, RenderedMail } from '../../shared/mail-templates'
import { DEFAULT_TEMPLATES, MAIL_TEMPLATE_KEYS, TEMPLATE_LABELS, renderTemplateContent } from '../../shared/mail-templates'
import { mailTemplates } from '../database/schema'
import { getBranding } from './branding.service'

/**
 * Individualisierbare E-Mail-Vorlagen (Verwaltung, Einstellungen) – ergaenzt
 * `shared/mail-templates.ts` um die Datenbank-Ebene: eine Vorlage ohne eigene Zeile rendert mit
 * `DEFAULT_TEMPLATES`, eine gespeicherte Zeile ersetzt Betreff und Text vollstaendig.
 */

export interface MailTemplateView extends MailTemplateContent {
  key: MailTemplate
  label: string
  isCustom: boolean
  updatedAt: Date | null
}

function row(key: MailTemplate) {
  return useDatabase().select().from(mailTemplates).where(eq(mailTemplates.key, key)).get()
}

function toView(key: MailTemplate): MailTemplateView {
  const existing = row(key)
  return {
    key,
    label: TEMPLATE_LABELS[key],
    subject: existing?.subject ?? DEFAULT_TEMPLATES[key].subject,
    body: existing?.body ?? DEFAULT_TEMPLATES[key].body,
    isCustom: !!existing,
    updatedAt: existing?.updatedAt ?? null,
  }
}

/** Betreff/Text fuer den tatsaechlichen Versand – DB-Zeile, sonst der Standard. */
export function getMailTemplateContent(key: MailTemplate): MailTemplateContent {
  const existing = row(key)
  return existing ? { subject: existing.subject, body: existing.body } : DEFAULT_TEMPLATES[key]
}

export function listMailTemplates(): MailTemplateView[] {
  return MAIL_TEMPLATE_KEYS.map(toView)
}

export function saveMailTemplate(key: MailTemplate, input: MailTemplateContent): MailTemplateView {
  const db = useDatabase()
  const existing = row(key)

  if (existing) {
    db.update(mailTemplates)
      .set({ subject: input.subject, body: input.body, updatedAt: new Date() })
      .where(eq(mailTemplates.key, key))
      .run()
  }
  else {
    db.insert(mailTemplates).values({ key, subject: input.subject, body: input.body }).run()
  }

  return toView(key)
}

/** Loescht die angepasste Vorlage wieder – die Vorlage rendert danach mit dem Standardtext. */
export function resetMailTemplate(key: MailTemplate): MailTemplateView {
  useDatabase().delete(mailTemplates).where(eq(mailTemplates.key, key)).run()
  return toView(key)
}

/** Vorschau mit Beispieldaten – fuer den Editor, ohne zu speichern oder zu versenden. */
export function previewMailTemplate(content: MailTemplateContent): RenderedMail {
  const sample: CourseMailData = {
    courseTitle: 'Truppmann Grundausbildung',
    dateRange: '22.08. – 24.08.2026',
    organisation: getBranding().name,
    recipientFirstName: 'Jonas',
    cancelUrl: 'https://lehrgaenge.example.org/abmeldung/beispiel-token',
    previousDateRange: '15.08. – 17.08.2026',
    signupName: 'Jonas Berger',
    signupEmail: 'jonas.berger@example.org',
  }
  return renderTemplateContent(content, sample)
}

/** Rendert eine Vorlage – ggf. angepasst – mit den echten Lehrgangsdaten fuer den Versand. */
export function renderMail(key: MailTemplate, data: CourseMailData): RenderedMail {
  return renderTemplateContent(getMailTemplateContent(key), data)
}
