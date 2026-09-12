import { randomUUID } from 'node:crypto'
import { and, asc, count, eq } from 'drizzle-orm'
import type { CreateCompletionInput } from '../../shared/validation/completion'
import { courseCompletions, courses, users } from '../database/schema'

/**
 * Abschluss-Historie (FV-18). Bewusst eine eigene Tabelle und ein eigener Service statt einer
 * Erweiterung von `signups` (FV-5) – die Interessensbekundung bildet nur den aktuellen
 * Anmeldezyklus ab und kennt keine Personenkonten (siehe AC-8, Regressionsschutz).
 *
 * Kein Import aus `course-admin.service.ts`: dieser Service liefert `hasCompletions` an
 * `deleteCourse` dort – ein Import in die Gegenrichtung waere ein Zirkelbezug. Die kleine
 * Existenzpruefung fuer den Lehrgang steht deshalb hier dupliziert statt `requireCourse` von
 * dort wiederzuverwenden.
 */

/** Ein Datum ohne Uhrzeit, in UTC (dieselbe Konvention wie `parseDate` in `course-admin.service.ts`). */
function parseDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`)
}

function requireCourseExists(courseId: string) {
  const course = useDatabase().select({ id: courses.id }).from(courses).where(eq(courses.id, courseId)).get()
  if (!course) {
    throw createError({ statusCode: 404, statusMessage: 'Lehrgang nicht gefunden.' })
  }
}

function requireAccountExists(userId: string) {
  const account = useDatabase().select({ id: users.id }).from(users).where(eq(users.id, userId)).get()
  if (!account) {
    throw createError({ statusCode: 404, statusMessage: 'Konto nicht gefunden.' })
  }
}

/** Vorab-Pruefung statt Exception-Handling bei Unique-Verletzung (Vorbild: `assertEmailFrei`). */
function assertNoExistingCompletion(courseId: string, userId: string) {
  const bestehend = useDatabase()
    .select({ id: courseCompletions.id })
    .from(courseCompletions)
    .where(and(eq(courseCompletions.courseId, courseId), eq(courseCompletions.userId, userId)))
    .get()

  if (bestehend) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Für dieses Mitglied ist dieser Lehrgang bereits als abgeschlossen erfasst.',
    })
  }
}

export interface CompletionView {
  userId: string
  displayName: string
  email: string
  completedAt: Date
  note: string | null
}

/** Alle Abschluesse eines Lehrgangs (FV-18, AC-6). */
export function listCompletions(courseId: string): CompletionView[] {
  requireCourseExists(courseId)

  return useDatabase()
    .select({
      userId: courseCompletions.userId,
      displayName: users.displayName,
      email: users.email,
      completedAt: courseCompletions.completedAt,
      note: courseCompletions.note,
    })
    .from(courseCompletions)
    .innerJoin(users, eq(courseCompletions.userId, users.id))
    .where(eq(courseCompletions.courseId, courseId))
    .orderBy(asc(users.displayName))
    .all()
}

/** Traegt einen Abschluss ein (FV-18, AC-2 bis AC-4). */
export function createCompletion(courseId: string, input: CreateCompletionInput) {
  requireCourseExists(courseId)
  requireAccountExists(input.userId)

  const completedAt = input.completedAt ? parseDate(input.completedAt) : new Date()
  if (completedAt.getTime() > Date.now()) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Der Abschluss darf nicht in der Zukunft liegen.',
    })
  }

  assertNoExistingCompletion(courseId, input.userId)

  useDatabase()
    .insert(courseCompletions)
    .values({
      id: randomUUID(),
      courseId,
      userId: input.userId,
      completedAt,
      note: input.note ?? null,
    })
    .run()

  return listCompletions(courseId).find(item => item.userId === input.userId)!
}

/** Entfernt einen versehentlichen Eintrag wieder (FV-18, AC-5). */
export function deleteCompletion(courseId: string, userId: string) {
  const db = useDatabase()
  const existing = db
    .select({ id: courseCompletions.id })
    .from(courseCompletions)
    .where(and(eq(courseCompletions.courseId, courseId), eq(courseCompletions.userId, userId)))
    .get()

  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Abschluss nicht gefunden.' })
  }

  db.delete(courseCompletions).where(eq(courseCompletions.id, existing.id)).run()
  return { ok: true }
}

/** Loeschschutz fuer `deleteCourse` (FV-18, AC-7). */
export function hasCompletions(courseId: string): boolean {
  const value = useDatabase()
    .select({ value: count() })
    .from(courseCompletions)
    .where(eq(courseCompletions.courseId, courseId))
    .get()?.value ?? 0

  return value > 0
}
