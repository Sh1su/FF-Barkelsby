import { randomUUID } from 'node:crypto'
import { and, count, desc, eq, ne } from 'drizzle-orm'
import type { SignupStatus } from '../../shared/constants'
import { SIGNUP_STATUS_LABELS } from '../../shared/constants'
import { TEMPLATES } from '../../shared/mail-templates'
import { toCsv } from '../../shared/csv'
import { courses, mailLog, signups } from '../database/schema'
import { formatRange } from './mail.service'

/**
 * Registratur der Verwaltung (FV-6).
 *
 * Statuswechsel laufen ausschliesslich ueber `transitionSignup`, damit unzulaessige
 * Uebergaenge an genau einer Stelle abgefangen werden.
 */

/**
 * Erlaubte Uebergaenge aus Sicht der Verwaltung.
 * `storniert` ist eine Sackgasse: dorthin kommt nur der Teilnehmer selbst ueber seinen
 * Abmelde-Link, und aus einem Storno macht die Wehrfuehrung keine Zusage.
 */
export const SIGNUP_TRANSITIONS: Record<SignupStatus, SignupStatus[]> = {
  offen: ['bestaetigt', 'abgelehnt'],
  bestaetigt: ['offen'],
  abgelehnt: ['offen'],
  storniert: [],
}

export function canTransitionSignup(from: SignupStatus, to: SignupStatus): boolean {
  return SIGNUP_TRANSITIONS[from].includes(to)
}

/** Welche Mail gehoert zu welchem Zielstatus? `offen` verschickt bewusst nichts. */
export function templateForStatus(to: SignupStatus) {
  if (to === 'bestaetigt') return 'anmeldung-bestaetigt' as const
  if (to === 'abgelehnt') return 'anmeldung-abgelehnt' as const
  return null
}

export interface SignupListQuery {
  status?: SignupStatus
  lehrgang?: string
  page: number
  limit: number
}

export function listSignups(query: SignupListQuery) {
  const db = useDatabase()

  const conditions = []
  if (query.status) conditions.push(eq(signups.status, query.status))
  if (query.lehrgang) conditions.push(eq(signups.courseId, query.lehrgang))
  const where = conditions.length > 0 ? and(...conditions) : undefined

  const items = db
    .select({
      id: signups.id,
      firstName: signups.firstName,
      lastName: signups.lastName,
      email: signups.email,
      status: signups.status,
      createdAt: signups.createdAt,
      courseId: signups.courseId,
      courseTitle: courses.title,
      courseStartsOn: courses.startsOn,
      courseStatus: courses.status,
    })
    .from(signups)
    .innerJoin(courses, eq(signups.courseId, courses.id))
    .where(where)
    .orderBy(desc(signups.createdAt))
    .limit(query.limit)
    .offset((query.page - 1) * query.limit)
    .all()

  const total = db
    .select({ value: count() })
    .from(signups)
    .innerJoin(courses, eq(signups.courseId, courses.id))
    .where(where)
    .get()?.value ?? 0

  // Zusammenfassung je Status ueber den gesamten Bestand (nicht nur die Seite).
  const summaryRows = db
    .select({ status: signups.status, value: count() })
    .from(signups)
    .groupBy(signups.status)
    .all()

  const summary = Object.fromEntries(
    summaryRows.map(row => [row.status, row.value]),
  ) as Partial<Record<SignupStatus, number>>

  return { items, total, page: query.page, limit: query.limit, summary }
}

function signupOrThrow(id: string) {
  const row = useDatabase()
    .select({
      id: signups.id,
      firstName: signups.firstName,
      lastName: signups.lastName,
      email: signups.email,
      status: signups.status,
      cancelToken: signups.cancelToken,
      courseId: signups.courseId,
    })
    .from(signups)
    .where(eq(signups.id, id))
    .get()

  if (!row) {
    throw createError({ statusCode: 404, statusMessage: 'Anmeldung nicht gefunden.' })
  }
  return row
}

/** Statuswechsel samt Mail (FV-6, AC-3 bis AC-5). */
export async function transitionSignup(id: string, to: SignupStatus) {
  const bestehend = signupOrThrow(id)

  if (bestehend.status === to) return { ...bestehend, status: to }

  if (!canTransitionSignup(bestehend.status, to)) {
    throw createError({
      statusCode: 422,
      statusMessage: `Aus dem Status „${SIGNUP_STATUS_LABELS[bestehend.status]}" ist dieser Schritt nicht vorgesehen.`,
    })
  }

  useDatabase()
    .update(signups)
    .set({ status: to, updatedAt: new Date() })
    .where(eq(signups.id, id))
    .run()

  const template = templateForStatus(to)
  if (template) {
    await notifySignup(template, bestehend.courseId, {
      id: bestehend.id,
      firstName: bestehend.firstName,
      email: bestehend.email,
      cancelToken: bestehend.cancelToken,
    })
  }

  return { ...bestehend, status: to }
}

async function notifySignup(
  template: 'anmeldung-bestaetigt' | 'anmeldung-abgelehnt',
  courseId: string,
  signup: { id: string, firstName: string, email: string, cancelToken: string },
) {
  const course = useDatabase().select().from(courses).where(eq(courses.id, courseId)).get()
  if (!course) return

  const config = useRuntimeConfig()
  const cancelUrl = `${String(config.public.baseUrl).replace(/\/$/, '')}/abmeldung/${signup.cancelToken}`

  const mail = TEMPLATES[template]({
    courseTitle: course.title,
    dateRange: formatRange(course.startsOn, course.endsOn),
    organisation: config.public.organisation.name,
    recipientFirstName: signup.firstName,
    // Die Absage braucht keinen Abmelde-Link mehr.
    cancelUrl: template === 'anmeldung-bestaetigt' ? cancelUrl : undefined,
  })

  const ergebnis = isMailEnabled()
    ? await sendMail({ to: signup.email, subject: mail.subject, text: mail.text })
    : { ok: false, error: 'SMTP nicht konfiguriert' }

  useDatabase()
    .insert(mailLog)
    .values({
      id: randomUUID(),
      courseId,
      signupId: signup.id,
      recipient: signup.email,
      template,
      subject: mail.subject,
      status: ergebnis.ok ? 'versendet' : isMailEnabled() ? 'fehlgeschlagen' : 'nicht_versendet',
      error: ergebnis.ok ? null : ergebnis.error ?? null,
      sentAt: ergebnis.ok ? new Date() : null,
    })
    .run()
}

/** Anwesenheitsliste als CSV (FV-6, AC-7/AC-8). Stornierte bleiben draussen. */
export function signupsCsv(courseId: string): { filename: string, content: string } {
  const db = useDatabase()

  const course = db.select().from(courses).where(eq(courses.id, courseId)).get()
  if (!course) {
    throw createError({ statusCode: 404, statusMessage: 'Lehrgang nicht gefunden.' })
  }

  const rows = db
    .select({
      lastName: signups.lastName,
      firstName: signups.firstName,
      email: signups.email,
      status: signups.status,
      createdAt: signups.createdAt,
    })
    .from(signups)
    .where(and(eq(signups.courseId, courseId), ne(signups.status, 'storniert')))
    .orderBy(signups.lastName, signups.firstName)
    .all()

  const datum = new Intl.DateTimeFormat('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })

  const content = toCsv(
    ['Nachname', 'Vorname', 'E-Mail', 'Status', 'Angemeldet am'],
    rows.map(row => [
      row.lastName,
      row.firstName,
      row.email,
      SIGNUP_STATUS_LABELS[row.status],
      datum.format(row.createdAt),
    ]),
  )

  const slug = course.title
    .toLowerCase()
    .replace(/[äöüß]/g, zeichen => ({ ä: 'ae', ö: 'oe', ü: 'ue', ß: 'ss' })[zeichen] ?? zeichen)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)

  return { filename: `teilnehmer-${slug || 'lehrgang'}.csv`, content }
}
