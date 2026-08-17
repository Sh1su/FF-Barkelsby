import { randomUUID } from 'node:crypto'
import { and, eq, inArray } from 'drizzle-orm'
import type { CourseMailData, MailTemplate } from '../../shared/mail-templates'
import { TEMPLATES } from '../../shared/mail-templates'
import { mailLog, signups } from '../database/schema'

/**
 * Versand der Lehrgangs-E-Mails (FV-4).
 *
 * Jeder Empfaenger bekommt eine eigene Nachricht – niemals ein gemeinsames CC, sonst saehen
 * die Angehoerigen der Wehr gegenseitig ihre Adressen (AC-7).
 */

/** Nur wer noch mitgenommen werden will, bekommt Post: abgelehnt und storniert nicht (AC-5). */
const NOTIFIED_STATUSES = ['offen', 'bestaetigt'] as const

const dateFormatter = new Intl.DateTimeFormat('de-DE', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})
const dayMonthFormatter = new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit' })

/** Gleiche Schreibweise wie in der Oberflaeche: "22.08. – 24.08.2026". */
export function formatRange(start: Date, end: Date): string {
  if (start.toDateString() === end.toDateString()) return dateFormatter.format(start)
  return `${dayMonthFormatter.format(start)} – ${dateFormatter.format(end)}`
}

export interface CourseForMail {
  id: string
  title: string
  startsOn: Date
  endsOn: Date
  timeLabel: string | null
  location: string | null
}

function recipientsFor(courseId: string) {
  return useDatabase()
    .select({
      id: signups.id,
      firstName: signups.firstName,
      email: signups.email,
    })
    .from(signups)
    .where(
      and(eq(signups.courseId, courseId), inArray(signups.status, [...NOTIFIED_STATUSES])),
    )
    .all()
}

function logMail(entry: {
  courseId: string
  signupId: string
  recipient: string
  template: MailTemplate
  subject: string
  status: 'versendet' | 'nicht_versendet' | 'fehlgeschlagen'
  error?: string
}) {
  useDatabase()
    .insert(mailLog)
    .values({
      id: randomUUID(),
      courseId: entry.courseId,
      signupId: entry.signupId,
      recipient: entry.recipient,
      template: entry.template,
      subject: entry.subject,
      status: entry.status,
      error: entry.error ?? null,
      sentAt: entry.status === 'versendet' ? new Date() : null,
    })
    .run()
}

/**
 * Verschickt eine Vorlage an alle betroffenen Interessenten und protokolliert jeden Versuch.
 * Wirft nie: ein nicht erreichbares Relay darf die Absage nicht rueckgaengig machen (AC-3).
 */
export async function notifyCourseRecipients(
  template: MailTemplate,
  course: CourseForMail,
  extra: Partial<CourseMailData> = {},
): Promise<{ sent: number, failed: number, skipped: number }> {
  const organisation = useRuntimeConfig().public.organisation.name
  const recipients = recipientsFor(course.id)
  const render = TEMPLATES[template]

  let sent = 0
  let failed = 0
  let skipped = 0

  for (const recipient of recipients) {
    const mail = render({
      courseTitle: course.title,
      dateRange: formatRange(course.startsOn, course.endsOn),
      timeLabel: course.timeLabel,
      location: course.location,
      organisation,
      recipientFirstName: recipient.firstName,
      ...extra,
    })

    if (!isMailEnabled()) {
      skipped++
      logMail({
        courseId: course.id,
        signupId: recipient.id,
        recipient: recipient.email,
        template,
        subject: mail.subject,
        status: 'nicht_versendet',
        error: 'SMTP nicht konfiguriert',
      })
      continue
    }

    const result = await sendMail({ to: recipient.email, subject: mail.subject, text: mail.text })

    if (result.ok) sent++
    else failed++

    logMail({
      courseId: course.id,
      signupId: recipient.id,
      recipient: recipient.email,
      template,
      subject: mail.subject,
      status: result.ok ? 'versendet' : 'fehlgeschlagen',
      error: result.error,
    })
  }

  return { sent, failed, skipped }
}

/** Auswertung fuer die Verwaltung (AC-8). */
export function mailLogForCourse(courseId: string) {
  return useDatabase()
    .select()
    .from(mailLog)
    .where(eq(mailLog.courseId, courseId))
    .all()
}
