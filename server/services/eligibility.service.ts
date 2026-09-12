import { and, count, eq, inArray } from 'drizzle-orm'
import { courseCompletions, coursePrerequisites } from '../database/schema'

/**
 * Voraussetzungs-Engine (FV-20). Wertet aus, ob ein *Mitglied* einen Lehrgang sehen darf –
 * die reine Beziehung zwischen Lehrgängen (`course_prerequisites`, FV-17) und die
 * Abschluss-Historie (`course_completions`, FV-18) werden hier nur gelesen, nicht verändert.
 *
 * Sichtbarkeitsregel: ein Lehrgang erscheint für ein Mitglied, wenn es entweder alle
 * Voraussetzungen erfüllt (`isEligible`) oder den Lehrgang selbst schon abgeschlossen hat
 * (`hasCompleted`) – siehe FV-20, AC-1 bis AC-3.
 */

/** `true`, wenn eine Abschluss-Zeile für genau dieses Paar existiert (FV-20, AC-2). */
export function hasCompleted(userId: string, courseId: string): boolean {
  const row = useDatabase()
    .select({ id: courseCompletions.id })
    .from(courseCompletions)
    .where(and(eq(courseCompletions.userId, userId), eq(courseCompletions.courseId, courseId)))
    .get()

  return !!row
}

/**
 * `true`, wenn das Mitglied jede Voraussetzung von `courseId` abgeschlossen hat. Ein Lehrgang
 * ohne jede Voraussetzung ist automatisch berechtigt – leere Menge, Bedingung trivial erfüllt
 * (FV-20, AC-1, AC-6).
 */
export function isEligible(userId: string, courseId: string): boolean {
  const requiredCourseIds = useDatabase()
    .select({ requiredCourseId: coursePrerequisites.requiredCourseId })
    .from(coursePrerequisites)
    .where(eq(coursePrerequisites.courseId, courseId))
    .all()
    .map(row => row.requiredCourseId)

  if (requiredCourseIds.length === 0) return true

  const erfuellt = useDatabase()
    .select({ value: count() })
    .from(courseCompletions)
    .where(and(eq(courseCompletions.userId, userId), inArray(courseCompletions.courseId, requiredCourseIds)))
    .get()?.value ?? 0

  // UND-Verknüpfung: erst wenn jede einzelne Voraussetzung dabei ist, gilt der Lehrgang als
  // erfüllt (FV-20, Edge Case "zwei Voraussetzungen, eine erfüllt, eine nicht").
  return erfuellt === requiredCourseIds.length
}

/**
 * Batch-Variante für eine Kandidatenliste (FV-20, AC-7): höchstens zwei Abfragen statt einer
 * pro Lehrgang – alle relevanten Voraussetzungs-Kanten und alle Abschlüsse des Mitglieds werden
 * einmal geladen und danach in Prozessspeicher gegen die Liste geprüft (Vorbild:
 * `confirmedCounts` in `course.service.ts`).
 */
export function visibleCourseIds(userId: string, courseIds: string[]): Set<string> {
  if (courseIds.length === 0) return new Set()

  const edgeRows = useDatabase()
    .select({ courseId: coursePrerequisites.courseId, requiredCourseId: coursePrerequisites.requiredCourseId })
    .from(coursePrerequisites)
    .where(inArray(coursePrerequisites.courseId, courseIds))
    .all()

  const edges = new Map<string, string[]>()
  for (const row of edgeRows) {
    const list = edges.get(row.courseId)
    if (list) list.push(row.requiredCourseId)
    else edges.set(row.courseId, [row.requiredCourseId])
  }

  const completedRows = useDatabase()
    .select({ courseId: courseCompletions.courseId })
    .from(courseCompletions)
    .where(eq(courseCompletions.userId, userId))
    .all()
  const completed = new Set(completedRows.map(row => row.courseId))

  const visible = new Set<string>()
  for (const courseId of courseIds) {
    const required = edges.get(courseId) ?? []
    const eligible = required.every(id => completed.has(id))
    if (eligible || completed.has(courseId)) visible.add(courseId)
  }

  return visible
}
