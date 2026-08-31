import { and, asc, count, eq, gte, inArray, like, or, sql } from 'drizzle-orm'
import type { CourseListQuery } from '../../shared/validation/course'
import { courseDays, courses, signups } from '../database/schema'

/**
 * Fachlogik rund um Lehrgänge. Die Routen bleiben duenn:
 * validieren -> autorisieren -> Service -> Antwort formen.
 */

/**
 * Anmeldeschluss: ab dem Starttag eines Lehrgangs nimmt er keine Anmeldungen mehr an, auch wenn
 * er (bei mehrtaegigen Lehrgaengen) noch bis zum Enddatum sichtbar bleibt (FV-14, AC-4).
 */
export function isSignupOpen(status: string, startsOn: Date, now: Date = new Date()): boolean {
  const startOfToday = new Date(now)
  startOfToday.setHours(0, 0, 0, 0)
  return status !== 'abgesagt' && startsOn.getTime() > startOfToday.getTime()
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
  const startOfToday = new Date(now)
  startOfToday.setHours(0, 0, 0, 0)

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

/** Detailseite inkl. Programm (FV-2, AC-8). */
export function getCourseDetail(id: string) {
  const db = useDatabase()

  const course = db
    .select({
      ...cardColumns,
      description: courses.description,
      topics: courses.topics,
    })
    .from(courses)
    .where(eq(courses.id, id))
    .get()

  if (!course) {
    throw createError({ statusCode: 404, statusMessage: 'Lehrgang nicht gefunden.' })
  }

  const days = db
    .select({
      id: courseDays.id,
      dayNumber: courseDays.dayNumber,
      date: courseDays.date,
      timeLabel: courseDays.timeLabel,
      title: courseDays.title,
      bullets: courseDays.bullets,
    })
    .from(courseDays)
    .where(eq(courseDays.courseId, id))
    .orderBy(asc(courseDays.dayNumber))
    .all()

  const bestaetigt = confirmedCounts([id])[id] ?? 0

  return {
    ...course,
    confirmedCount: bestaetigt,
    signupOpen: isSignupOpen(course.status, course.startsOn),
    days,
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
