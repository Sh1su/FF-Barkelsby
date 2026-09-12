import { randomUUID } from 'node:crypto'
import { count, eq, inArray, ne } from 'drizzle-orm'
import { coursePrerequisites, courses } from '../database/schema'

/**
 * Fachlogik der Lehrgangs-Voraussetzungen (FV-17). Legt nur die *Beziehung* zwischen
 * Lehrgaengen fest – ob ein Mitglied eine Voraussetzung erfuellt, wertet erst FV-20 aus.
 */

export interface PrerequisiteCourse {
  id: string
  title: string
}

function requireCourseExists(id: string): void {
  const exists = useDatabase().select({ id: courses.id }).from(courses).where(eq(courses.id, id)).get()
  if (!exists) {
    throw createError({ statusCode: 404, statusMessage: 'Lehrgang nicht gefunden.' })
  }
}

/** Aktuelle Voraussetzungen eines Lehrgangs (FV-17, AC-6). */
export function getPrerequisites(courseId: string): PrerequisiteCourse[] {
  return useDatabase()
    .select({ id: courses.id, title: courses.title })
    .from(coursePrerequisites)
    .innerJoin(courses, eq(courses.id, coursePrerequisites.requiredCourseId))
    .where(eq(coursePrerequisites.courseId, courseId))
    .orderBy(courses.title)
    .all()
}

/** Alle Kanten des Voraussetzungsgraphen ausserhalb von `courseId` – dessen eigene Kanten werden gerade ersetzt. */
function loadOtherEdges(courseId: string): Map<string, string[]> {
  const rows = useDatabase()
    .select({ courseId: coursePrerequisites.courseId, requiredCourseId: coursePrerequisites.requiredCourseId })
    .from(coursePrerequisites)
    .where(ne(coursePrerequisites.courseId, courseId))
    .all()

  const edges = new Map<string, string[]>()
  for (const row of rows) {
    const list = edges.get(row.courseId)
    if (list) list.push(row.requiredCourseId)
    else edges.set(row.courseId, [row.requiredCourseId])
  }
  return edges
}

/**
 * Reachability-Suche (BFS): kann man von `start` aus ueber die uebergebenen Kanten `target`
 * erreichen? Reine Funktion ohne Datenbankzugriff, damit sie isoliert testbar bleibt
 * (FV-17, Tech Design). `start === target` gilt als erreicht (direkter Zyklus, AC-2).
 */
export function canReach(edges: Map<string, string[]>, start: string, target: string): boolean {
  const visited = new Set<string>([start])
  const queue = [start]

  while (queue.length > 0) {
    const current = queue.shift()!
    if (current === target) return true
    for (const next of edges.get(current) ?? []) {
      if (visited.has(next)) continue
      visited.add(next)
      queue.push(next)
    }
  }

  return false
}

/**
 * Ersetzt die komplette Voraussetzungsmenge eines Lehrgangs (FV-17, AC-3 bis AC-5).
 * Prueft zuerst die Existenz aller `requiredCourseIds` (404), dann fuer jede vorgeschlagene
 * Kante, ob sie – ueber die bestehenden Kanten *anderer* Lehrgaenge – bereits zurueck zu
 * `courseId` fuehrt (422, Zyklus). Erst danach werden die alten Kanten ersetzt.
 */
export function setPrerequisites(courseId: string, requiredCourseIds: string[]): void {
  const db = useDatabase()
  requireCourseExists(courseId)

  const uniqueIds = [...new Set(requiredCourseIds)]

  if (uniqueIds.length > 0) {
    const existing = db.select({ id: courses.id }).from(courses).where(inArray(courses.id, uniqueIds)).all()
    const existingIds = new Set(existing.map(row => row.id))
    const missing = uniqueIds.filter(id => !existingIds.has(id))
    if (missing.length > 0) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Mindestens ein vorausgesetzter Lehrgang wurde nicht gefunden.',
      })
    }
  }

  const otherEdges = loadOtherEdges(courseId)
  for (const requiredCourseId of uniqueIds) {
    if (requiredCourseId === courseId || canReach(otherEdges, requiredCourseId, courseId)) {
      throw createError({
        statusCode: 422,
        statusMessage: 'Das würde einen Zyklus in den Voraussetzungen erzeugen.',
      })
    }
  }

  db.transaction((tx) => {
    tx.delete(coursePrerequisites).where(eq(coursePrerequisites.courseId, courseId)).run()
    for (const requiredCourseId of uniqueIds) {
      tx.insert(coursePrerequisites).values({ id: randomUUID(), courseId, requiredCourseId }).run()
    }
  })
}

/** Wirft 409, wenn `courseId` Voraussetzung fuer einen anderen Lehrgang ist (FV-17, AC-8). */
export function assertNotRequiredByOthers(courseId: string): void {
  const requiredFor = useDatabase()
    .select({ value: count() })
    .from(coursePrerequisites)
    .where(eq(coursePrerequisites.requiredCourseId, courseId))
    .get()?.value ?? 0

  if (requiredFor > 0) {
    throw createError({
      statusCode: 409,
      statusMessage:
        'Dieser Lehrgang ist Voraussetzung für einen anderen Lehrgang und kann deshalb nicht gelöscht werden.',
    })
  }
}
