import { asc, eq } from 'drizzle-orm'
import { courseCompletions, courses, users } from '../database/schema'

/**
 * Admin-Matrix (FV-19): Abschluss-Status je Mitglied und Lehrgang.
 *
 * Bewusst **keine** Berechtigungs-/Voraussetzungs-Auswertung (FV-17/FV-20) – siehe
 * "Scope-Entscheidung" in `features/FV-19-admin-matrix.md`. Diese Datei liest nur, was FV-18
 * (`course_completions`) bereits schreibt, und stellt es in einer Form bereit, die sich im
 * Frontend ohne N+1-Lookups rendern laesst.
 */

export interface MatrixMember {
  id: string
  displayName: string
  email: string
  active: boolean
}

export interface MatrixCourse {
  id: string
  title: string
}

export interface Matrix {
  members: MatrixMember[]
  courses: MatrixCourse[]
  /**
   * Sparse Map statt vollem Gitter mit expliziten `null`-Eintraegen fuer jedes Paar: bei vielen
   * Mitgliedern x Lehrgaengen waere Letzteres unnoetig grosse Nutzlast (Tech Design erlaubt
   * ausdruecklich "eine flachere Form"). Ein fehlender Eintrag bedeutet "kein Abschluss" –
   * das Frontend liest `completions[memberId]?.[courseId]` und behandelt `undefined` wie `null`.
   */
  completions: Record<string, Record<string, string>>
}

/** Liefert alle Mitgliedskonten und Lehrgaenge sowie die Abschluss-Historie dazwischen (AC-1). */
export function getMatrix(): Matrix {
  const db = useDatabase()

  const members: MatrixMember[] = db
    .select({
      id: users.id,
      displayName: users.displayName,
      email: users.email,
      deactivatedAt: users.deactivatedAt,
    })
    .from(users)
    .where(eq(users.role, 'member'))
    .orderBy(asc(users.displayName))
    .all()
    .map(({ deactivatedAt, ...rest }) => ({ ...rest, active: deactivatedAt === null }))

  const courseList: MatrixCourse[] = db
    .select({ id: courses.id, title: courses.title })
    .from(courses)
    .orderBy(asc(courses.title))
    .all()

  const rows = db
    .select({
      userId: courseCompletions.userId,
      courseId: courseCompletions.courseId,
      completedAt: courseCompletions.completedAt,
    })
    .from(courseCompletions)
    .all()

  const completions: Record<string, Record<string, string>> = {}
  for (const row of rows) {
    completions[row.userId] ??= {}
    completions[row.userId]![row.courseId] = row.completedAt.toISOString()
  }

  return { members, courses: courseList, completions }
}
