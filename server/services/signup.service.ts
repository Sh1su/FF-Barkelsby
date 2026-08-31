import { randomBytes, randomUUID } from 'node:crypto'
import { and, count, eq, ne } from 'drizzle-orm'
import type { CreateSignupInput } from '../../shared/validation/signup'
import { courses, mailLog, signups } from '../database/schema'
import { TEMPLATES } from '../../shared/mail-templates'
import { formatRange } from './mail.service'
import { isSignupOpen } from './course.service'

/**
 * Interessensbekundung ohne persoenliches Konto (FV-5).
 *
 * Bewusst schlank: drei Felder, eine Einwilligung, ein Zufallstoken fuer die Selbstabmeldung.
 * Mehr personenbezogene Daten erhebt die Anwendung nicht (PRD, Datenschutz).
 */

function courseOrThrow(courseId: string) {
  const course = useDatabase().select().from(courses).where(eq(courses.id, courseId)).get()
  if (!course) {
    throw createError({ statusCode: 404, statusMessage: 'Lehrgang nicht gefunden.' })
  }
  return course
}

export function confirmedCount(courseId: string): number {
  return useDatabase()
    .select({ value: count() })
    .from(signups)
    .where(and(eq(signups.courseId, courseId), eq(signups.status, 'bestaetigt')))
    .get()?.value ?? 0
}

/** Legt die Anmeldung an und verschickt die beiden Mails (FV-5, AC-2 bis AC-7). */
export async function createSignup(courseId: string, input: CreateSignupInput) {
  const db = useDatabase()
  const course = courseOrThrow(courseId)

  if (course.status === 'abgesagt') {
    throw createError({
      statusCode: 422,
      statusMessage: 'Dieser Lehrgang wurde abgesagt und nimmt keine Anmeldungen mehr an.',
    })
  }

  // Es gibt keine Platzzahl - Anmeldungen sind offen, bis der Lehrgang beginnt (FV-14, AC-4).
  if (!isSignupOpen(course.status, course.startsOn)) {
    throw createError({
      statusCode: 422,
      statusMessage: 'Dieser Lehrgang hat bereits begonnen und nimmt keine Anmeldungen mehr an.',
    })
  }

  // Doppelte Anmeldung derselben Adresse blocken – stornierte zaehlen nicht (PRD, Q22).
  const bestehend = db
    .select({ id: signups.id })
    .from(signups)
    .where(
      and(
        eq(signups.courseId, courseId),
        eq(signups.email, input.email),
        ne(signups.status, 'storniert'),
      ),
    )
    .get()

  if (bestehend) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Für diesen Lehrgang liegt bereits eine Anmeldung mit dieser Adresse vor.',
    })
  }

  const id = randomUUID()
  const cancelToken = randomBytes(24).toString('base64url')

  db.insert(signups)
    .values({
      id,
      courseId,
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email,
      status: 'offen',
      cancelToken,
      consentAt: new Date(),
    })
    .run()

  await sendSignupMails(course, {
    id,
    firstName: input.firstName,
    lastName: input.lastName,
    email: input.email,
    cancelToken,
  })

  // Der Token verlaesst den Server nur per E-Mail, nicht in der Antwort.
  return { id, status: 'offen' as const }
}

interface SignupForMail {
  id: string
  firstName: string
  lastName: string
  email: string
  cancelToken: string
}

async function sendSignupMails(
  course: typeof courses.$inferSelect,
  signup: SignupForMail,
): Promise<void> {
  const config = useRuntimeConfig()
  const organisation = config.public.organisation.name
  const cancelUrl = `${String(config.public.baseUrl).replace(/\/$/, '')}/abmeldung/${signup.cancelToken}`

  const basis = {
    courseTitle: course.title,
    dateRange: formatRange(course.startsOn, course.endsOn),
    organisation,
  }

  await deliver('anmeldung-eingegangen', signup.email, course.id, signup.id, {
    ...basis,
    recipientFirstName: signup.firstName,
    cancelUrl,
  })

  // Die Wehrfuehrung bekommt eine eigene Nachricht an die Absenderadresse der Anlage.
  const wehrfuehrung = String(config.smtpFrom ?? '').trim()
  if (wehrfuehrung) {
    await deliver('anmeldung-neu', wehrfuehrung, course.id, signup.id, {
      ...basis,
      recipientFirstName: '',
      signupName: `${signup.firstName} ${signup.lastName}`,
      signupEmail: signup.email,
    })
  }
}

async function deliver(
  template: 'anmeldung-eingegangen' | 'anmeldung-neu',
  recipient: string,
  courseId: string,
  signupId: string,
  data: Parameters<(typeof TEMPLATES)[typeof template]>[0],
) {
  const mail = TEMPLATES[template](data)

  const ergebnis = isMailEnabled()
    ? await sendMail({ to: recipient, subject: mail.subject, text: mail.text })
    : { ok: false, error: 'SMTP nicht konfiguriert' }

  useDatabase()
    .insert(mailLog)
    .values({
      id: randomUUID(),
      courseId,
      signupId,
      recipient,
      template,
      subject: mail.subject,
      status: ergebnis.ok ? 'versendet' : isMailEnabled() ? 'fehlgeschlagen' : 'nicht_versendet',
      error: ergebnis.ok ? null : ergebnis.error ?? null,
      sentAt: ergebnis.ok ? new Date() : null,
    })
    .run()
}

/** Anmeldung zu einem Abmelde-Token – ohne gueltigen Token gibt es keine Auskunft (AC-8/AC-9). */
export function signupByToken(token: string) {
  const row = useDatabase()
    .select({
      id: signups.id,
      firstName: signups.firstName,
      status: signups.status,
      courseTitle: courses.title,
      startsOn: courses.startsOn,
      endsOn: courses.endsOn,
    })
    .from(signups)
    .innerJoin(courses, eq(signups.courseId, courses.id))
    .where(eq(signups.cancelToken, token))
    .get()

  if (!row) {
    throw createError({ statusCode: 404, statusMessage: 'Dieser Abmelde-Link ist unbekannt.' })
  }

  return row
}

/** Selbstabmeldung (AC-8). Zweimaliges Klicken ist kein Fehler. */
export function cancelSignupByToken(token: string) {
  const bestehend = signupByToken(token)

  if (bestehend.status === 'storniert') {
    return { ...bestehend, bereitsStorniert: true }
  }

  useDatabase()
    .update(signups)
    .set({ status: 'storniert', updatedAt: new Date() })
    .where(eq(signups.cancelToken, token))
    .run()

  return { ...bestehend, status: 'storniert' as const, bereitsStorniert: false }
}
