import { randomUUID } from 'node:crypto'
import { and, asc, count, eq, gte, lte } from 'drizzle-orm'
import type {
  CreateCourseInput,
  UpdateCourseInput,
} from '../../shared/validation/course'
import type { CourseStatus } from '../../shared/constants'
import { courseDays, courses, instructors, signups } from '../database/schema'
import { formatRange, notifyCourseRecipients } from './mail.service'

/**
 * Schreibende Fachlogik der Verwaltung (FV-3).
 * Statusuebergaenge laufen ausschliesslich ueber `transitionCourse`.
 */

/** Ein Datum ohne Uhrzeit, in UTC – die Anwendung rechnet nie mit lokalen Zeitzonen. */
export function parseDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`)
}

/** Erlaubte Statusuebergaenge eines Lehrgangs (FV-3, AC-10/AC-11). */
export const COURSE_TRANSITIONS: Record<CourseStatus, CourseStatus[]> = {
  geplant: ['abgesagt'],
  abgesagt: ['geplant'],
}

export function canTransition(from: CourseStatus, to: CourseStatus): boolean {
  return COURSE_TRANSITIONS[from].includes(to)
}

export function countConfirmedSignups(courseId: string): number {
  return useDatabase()
    .select({ value: count() })
    .from(signups)
    .where(and(eq(signups.courseId, courseId), eq(signups.status, 'bestaetigt')))
    .get()?.value ?? 0
}

export function countSignups(courseId: string): number {
  return useDatabase()
    .select({ value: count() })
    .from(signups)
    .where(eq(signups.courseId, courseId))
    .get()?.value ?? 0
}

function requireCourse(id: string) {
  const course = useDatabase().select().from(courses).where(eq(courses.id, id)).get()
  if (!course) {
    throw createError({ statusCode: 404, statusMessage: 'Lehrgang nicht gefunden.' })
  }
  return course
}

/** Kalenderdaten der Verwaltung: alle Lehrgaenge, die den Zeitraum beruehren (FV-3, AC-2/AC-3). */
export function listCoursesInRange(from?: string, to?: string) {
  const db = useDatabase()
  const conditions = []

  // Ein mehrtaegiger Lehrgang gehoert in jeden Monat, den er beruehrt.
  if (to) conditions.push(lte(courses.startsOn, parseDate(to)))
  if (from) conditions.push(gte(courses.endsOn, parseDate(from)))

  return db
    .select({
      id: courses.id,
      title: courses.title,
      category: courses.category,
      format: courses.format,
      startsOn: courses.startsOn,
      endsOn: courses.endsOn,
      timeLabel: courses.timeLabel,
      capacity: courses.capacity,
      status: courses.status,
      instructorName: instructors.name,
      updatedAt: courses.updatedAt,
    })
    .from(courses)
    .leftJoin(instructors, eq(courses.instructorId, instructors.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(asc(courses.startsOn))
    .all()
}

export function createCourse(input: CreateCourseInput) {
  const db = useDatabase()
  const id = randomUUID()

  db.insert(courses)
    .values({
      id,
      title: input.title,
      category: input.category,
      format: input.format,
      startsOn: parseDate(input.startsOn),
      endsOn: parseDate(input.endsOn),
      timeLabel: input.timeLabel,
      location: input.location,
      capacity: input.capacity,
      instructorId: input.instructorId || null,
      motif: input.motif ?? null,
      palette: input.palette ?? null,
    })
    .run()

  return requireCourse(id)
}

export async function updateCourse(id: string, input: UpdateCourseInput) {
  const db = useDatabase()
  const existing = requireCourse(id)

  // Optimistisches Sperren: zwei Admins am selben Lehrgang (FV-3, Edge Case).
  if (
    typeof input.updatedAt === 'number'
    && Math.floor(existing.updatedAt.getTime() / 1000) !== input.updatedAt
  ) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Der Lehrgang wurde zwischenzeitlich geändert. Bitte neu laden.',
    })
  }

  const startsOn = input.startsOn ? parseDate(input.startsOn) : existing.startsOn
  const endsOn = input.endsOn ? parseDate(input.endsOn) : existing.endsOn

  if (endsOn < startsOn) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Das Ende darf nicht vor dem Beginn liegen.',
    })
  }

  // Kapazitaet nie unter die bereits bestaetigten Anmeldungen (FV-3, AC-14).
  if (typeof input.capacity === 'number' && input.capacity > 0) {
    const confirmed = countConfirmedSignups(id)
    if (input.capacity < confirmed) {
      throw createError({
        statusCode: 422,
        statusMessage: `Es sind bereits ${confirmed} Anmeldungen bestätigt – die Platzzahl kann nicht darunter liegen.`,
      })
    }
  }

  db.transaction((tx) => {
    tx.update(courses)
      .set({
        title: input.title ?? existing.title,
        summary: input.summary ?? existing.summary,
        description: input.description ?? existing.description,
        topics: input.topics ?? existing.topics,
        category: input.category ?? existing.category,
        format: input.format ?? existing.format,
        startsOn,
        endsOn,
        timeLabel: input.timeLabel ?? existing.timeLabel,
        location: input.location ?? existing.location,
        capacity: input.capacity ?? existing.capacity,
        instructorId: input.instructorId === undefined ? existing.instructorId : input.instructorId,
        motif: input.motif === undefined ? existing.motif : input.motif,
        palette: input.palette === undefined ? existing.palette : input.palette,
        updatedAt: new Date(),
      })
      .where(eq(courses.id, id))
      .run()

    if (input.days) {
      // Programmtage werden als Ganzes ersetzt – so bleibt die Reihenfolge eindeutig.
      tx.delete(courseDays).where(eq(courseDays.courseId, id)).run()

      for (const day of input.days) {
        tx.insert(courseDays)
          .values({
            id: randomUUID(),
            courseId: id,
            dayNumber: day.dayNumber,
            date: day.date ? parseDate(day.date) : null,
            timeLabel: day.timeLabel,
            title: day.title,
            bullets: day.bullets ?? null,
          })
          .run()
      }
    }
  })

  const updated = requireCourse(id)

  // Terminaenderung benachrichtigen – andere Aenderungen bewusst nicht (FV-4, AC-6).
  const moved = startsOn.getTime() !== existing.startsOn.getTime()
    || endsOn.getTime() !== existing.endsOn.getTime()

  if (moved && updated.status === 'geplant') {
    await notifyCourseRecipients(
      'lehrgang-verschoben',
      {
        id: updated.id,
        title: updated.title,
        startsOn: updated.startsOn,
        endsOn: updated.endsOn,
        timeLabel: updated.timeLabel,
        location: updated.location,
      },
      { previousDateRange: formatRange(existing.startsOn, existing.endsOn) },
    )
  }

  return updated
}

/** Absagen und Zuruecknehmen der Absage (FV-3, AC-10/AC-11; Mailversand FV-4, AC-5). */
export async function transitionCourse(id: string, to: CourseStatus) {
  const existing = requireCourse(id)

  // Zweite Absage ist kein Statuswechsel und loest deshalb auch keine zweite Mail aus.
  if (existing.status === to) return existing

  if (!canTransition(existing.status, to)) {
    throw createError({
      statusCode: 422,
      statusMessage: `Statuswechsel von ${existing.status} nach ${to} ist nicht vorgesehen.`,
    })
  }

  useDatabase()
    .update(courses)
    .set({ status: to, updatedAt: new Date() })
    .where(eq(courses.id, id))
    .run()

  const updated = requireCourse(id)

  // Absage: alle Interessenten benachrichtigen. Der Versand darf den Vorgang nicht kippen –
  // `notifyCourseRecipients` wirft nicht und protokolliert jeden Versuch (FV-4, AC-3).
  if (to === 'abgesagt') {
    await notifyCourseRecipients('lehrgang-abgesagt', {
      id: updated.id,
      title: updated.title,
      startsOn: updated.startsOn,
      endsOn: updated.endsOn,
      timeLabel: updated.timeLabel,
      location: updated.location,
    })
  }

  return updated
}

/** Löschen nur ohne Anmeldungen (FV-3, AC-12). */
export function deleteCourse(id: string) {
  requireCourse(id)

  const existingSignups = countSignups(id)
  if (existingSignups > 0) {
    throw createError({
      statusCode: 409,
      statusMessage:
        'Zu diesem Lehrgang gibt es bereits Anmeldungen. Bitte den Lehrgang absagen statt löschen.',
    })
  }

  useDatabase().delete(courses).where(eq(courses.id, id)).run()
  return { ok: true }
}

export function listInstructors() {
  return useDatabase()
    .select()
    .from(instructors)
    .orderBy(asc(instructors.name))
    .all()
}

export function createInstructor(input: { name: string, role?: string, vita?: string, motif?: number }) {
  const db = useDatabase()
  const id = randomUUID()

  db.insert(instructors)
    .values({ id, name: input.name, role: input.role, vita: input.vita, motif: input.motif ?? null })
    .run()

  return db.select().from(instructors).where(eq(instructors.id, id)).get()!
}

/** Nur fuer die Belegungsanzeige der Verwaltung. */
export function confirmedCountsByCourse(): Record<string, number> {
  const rows = useDatabase()
    .select({ courseId: signups.courseId, value: count() })
    .from(signups)
    .where(eq(signups.status, 'bestaetigt'))
    .groupBy(signups.courseId)
    .all()

  return Object.fromEntries(rows.map(row => [row.courseId, row.value]))
}
