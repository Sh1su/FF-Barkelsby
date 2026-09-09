import { and, asc, count, eq, gte, inArray, like, or, sql } from 'drizzle-orm'
import type { CourseListQuery } from '../../shared/validation/course'
import { courses, signups } from '../database/schema'

/**
 * Fachlogik rund um Lehrgänge. Die Routen bleiben duenn:
 * validieren -> autorisieren -> Service -> Antwort formen.
 */

/**
 * Tagesbeginn in UTC – Termine werden ausschliesslich in UTC gespeichert und verglichen
 * (siehe `parseDate` in `course-admin.service.ts`). `setHours(0, 0, 0, 0)` würde stattdessen in
 * der lokalen Zeitzone des Servers runden; in Zeitzonen mit positivem UTC-Offset (z. B.
 * Europe/Berlin im Sommer) läge der lokale Tagesbeginn dann vor dem gespeicherten UTC-Termin des
 * Starttags selbst, wodurch der Anmeldeschluss am Starttag zu spät griffe.
 */
function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}

/**
 * Anmeldeschluss: ab dem Starttag eines Lehrgangs nimmt er keine Anmeldungen mehr an, auch wenn
 * er (bei mehrtaegigen Lehrgaengen) noch bis zum Enddatum sichtbar bleibt (FV-14, AC-4).
 */
export function isSignupOpen(status: string, startsOn: Date, now: Date = new Date()): boolean {
  return status !== 'abgesagt' && startsOn.getTime() > startOfUtcDay(now).getTime()
}

/** Bestaetigte Anmeldungen je Lehrgang – eine Abfrage statt einer je Karte (FV-5, AC-11). */
function confirmedCounts(courseIds: string[]): Record<string, number> {
  if (courseIds.length === 0) return {}

  const rows = useDatabase()
    .select({ courseId: signups.courseId, value: count() })
    .from(signups)
    .where(and(inArray(signups.courseId, courseIds), eq(signups.status, 'bestaetigt')))
    .groupBy(signups.courseId)
    .all()

  return Object.fromEntries(rows.map(row => [row.courseId, row.value]))
}

const cardColumns = {
  id: courses.id,
  title: courses.title,
  summary: courses.summary,
  startsOn: courses.startsOn,
  endsOn: courses.endsOn,
  status: courses.status,
  motif: courses.motif,
  palette: courses.palette,
}

/**
 * Übersicht fuer die Gast-Ansicht: nur kommende und laufende Lehrgaenge (FV-2, AC-1),
 * sortiert nach Beginn.
 */
export function listUpcomingCourses(query: CourseListQuery, now: Date = new Date()) {
  const db = useDatabase()

  // Ein Lehrgang bleibt sichtbar, solange sein Enddatum nicht vorbei ist.
  const startOfToday = startOfUtcDay(now)

  const conditions = [gte(courses.endsOn, startOfToday)]

  if (query.q) {
    const needle = `%${query.q.toLowerCase()}%`
    conditions.push(
      or(
        like(sql`lower(${courses.title})`, needle),
        like(sql`lower(coalesce(${courses.summary}, ''))`, needle),
      )!,
    )
  }

  const where = and(...conditions)
  const offset = (query.page - 1) * query.limit

  const items = db
    .select(cardColumns)
    .from(courses)
    .where(where)
    .orderBy(asc(courses.startsOn), asc(courses.title))
    .limit(query.limit)
    .offset(offset)
    .all()

  const total = db
    .select({ value: count() })
    .from(courses)
    .where(where)
    .get()?.value ?? 0

  const belegung = confirmedCounts(items.map(item => item.id))

  return {
    items: items.map((item) => {
      const bestaetigt = belegung[item.id] ?? 0
      return {
        ...item,
        confirmedCount: bestaetigt,
        signupOpen: isSignupOpen(item.status, item.startsOn, now),
      }
    }),
    total,
    page: query.page,
    limit: query.limit,
  }
}

/** Detailseite (FV-2, AC-8). */
export function getCourseDetail(id: string) {
  const db = useDatabase()

  const course = db
    .select({
      ...cardColumns,
      description: courses.description,
    })
    .from(courses)
    .where(eq(courses.id, id))
    .get()

  if (!course) {
    throw createError({ statusCode: 404, statusMessage: 'Lehrgang nicht gefunden.' })
  }

  const bestaetigt = confirmedCounts([id])[id] ?? 0

  return {
    ...course,
    confirmedCount: bestaetigt,
    signupOpen: isSignupOpen(course.status, course.startsOn),
  }
}

/** Minimaldaten fuer das generierte Titelbild. */
export function getCourseCoverInput(id: string) {
  const course = useDatabase()
    .select({
      id: courses.id,
      title: courses.title,
      motif: courses.motif,
      palette: courses.palette,
    })
    .from(courses)
    .where(eq(courses.id, id))
    .get()

  if (!course) {
    throw createError({ statusCode: 404, statusMessage: 'Lehrgang nicht gefunden.' })
  }

  return course
}
