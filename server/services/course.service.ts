import { and, asc, count, eq, gte, inArray, like, or, sql } from 'drizzle-orm'
import type { CourseListQuery } from '../../shared/validation/course'
import { courseDays, courses, instructors, signups } from '../database/schema'

/**
 * Fachlogik rund um Lehrgänge. Die Routen bleiben duenn:
 * validieren -> autorisieren -> Service -> Antwort formen.
 */

/**
 * Belegung zaehlt ausschliesslich bestaetigte Anmeldungen (PRD, Q14).
 * Kapazitaet 0 bedeutet "unbegrenzt" – dann gibt es kein "ausgebucht".
 */
export function isFullyBooked(capacity: number, confirmedCount: number): boolean {
  if (capacity <= 0) return false
  return confirmedCount >= capacity
}

export function freeSeats(capacity: number, confirmedCount: number): number | null {
  if (capacity <= 0) return null
  return Math.max(0, capacity - confirmedCount)
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
  category: courses.category,
  format: courses.format,
  startsOn: courses.startsOn,
  endsOn: courses.endsOn,
  timeLabel: courses.timeLabel,
  location: courses.location,
  capacity: courses.capacity,
  status: courses.status,
  motif: courses.motif,
  palette: courses.palette,
  instructorName: instructors.name,
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

  if (query.kategorie) {
    conditions.push(eq(courses.category, query.kategorie))
  }

  if (query.q) {
    const needle = `%${query.q.toLowerCase()}%`
    conditions.push(
      or(
        like(sql`lower(${courses.title})`, needle),
        like(sql`lower(coalesce(${courses.summary}, ''))`, needle),
        like(sql`lower(coalesce(${instructors.name}, ''))`, needle),
      )!,
    )
  }

  const where = and(...conditions)
  const offset = (query.page - 1) * query.limit

  const items = db
    .select(cardColumns)
    .from(courses)
    .leftJoin(instructors, eq(courses.instructorId, instructors.id))
    .where(where)
    .orderBy(asc(courses.startsOn), asc(courses.title))
    .limit(query.limit)
    .offset(offset)
    .all()

  const total = db
    .select({ value: count() })
    .from(courses)
    .leftJoin(instructors, eq(courses.instructorId, instructors.id))
    .where(where)
    .get()?.value ?? 0

  const belegung = confirmedCounts(items.map(item => item.id))

  return {
    items: items.map((item) => {
      const bestaetigt = belegung[item.id] ?? 0
      return {
        ...item,
        confirmedCount: bestaetigt,
        fullyBooked: isFullyBooked(item.capacity, bestaetigt),
        freeSeats: freeSeats(item.capacity, bestaetigt),
      }
    }),
    total,
    page: query.page,
    limit: query.limit,
  }
}

/** Detailseite inkl. Programm und Ausbilder (FV-2, AC-8). */
export function getCourseDetail(id: string) {
  const db = useDatabase()

  const course = db
    .select({
      ...cardColumns,
      description: courses.description,
      topics: courses.topics,
      instructorId: courses.instructorId,
      instructorRole: instructors.role,
      instructorVita: instructors.vita,
      instructorMotif: instructors.motif,
    })
    .from(courses)
    .leftJoin(instructors, eq(courses.instructorId, instructors.id))
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

  const {
    instructorName,
    instructorRole,
    instructorVita,
    instructorMotif,
    instructorId,
    ...rest
  } = course

  const bestaetigt = confirmedCounts([id])[id] ?? 0

  return {
    ...rest,
    confirmedCount: bestaetigt,
    fullyBooked: isFullyBooked(course.capacity, bestaetigt),
    freeSeats: freeSeats(course.capacity, bestaetigt),
    instructor: instructorId
      ? {
          id: instructorId,
          name: instructorName,
          role: instructorRole,
          vita: instructorVita,
          motif: instructorMotif,
        }
      : null,
    days,
  }
}

/** Minimaldaten fuer das generierte Titelbild. */
export function getCourseCoverInput(id: string) {
  const course = useDatabase()
    .select({
      id: courses.id,
      title: courses.title,
      category: courses.category,
      motif: courses.motif,
      palette: courses.palette,
      instructorName: instructors.name,
    })
    .from(courses)
    .leftJoin(instructors, eq(courses.instructorId, instructors.id))
    .where(eq(courses.id, id))
    .get()

  if (!course) {
    throw createError({ statusCode: 404, statusMessage: 'Lehrgang nicht gefunden.' })
  }

  return course
}
