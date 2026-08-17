import { fetch } from '@nuxt/test-utils/e2e'

/**
 * Testdaten werden ueber die Verwaltungs-API angelegt statt direkt in die Datenbank
 * geschrieben – so laufen die Tests gegen denselben Weg wie die Oberflaeche.
 */
export interface CourseOverrides {
  title?: string
  startsOn?: string
  endsOn?: string
  category?: string
  format?: string
  timeLabel?: string
  location?: string
  capacity?: number
  instructorId?: string
  motif?: number
  palette?: number
}

/** Feste Bezugsdaten – keine Zufallswerte in Assertions (.claude/rules/testing.md). */
export const TODAY = new Date()

export function isoInDays(days: number): string {
  const date = new Date(TODAY)
  date.setDate(date.getDate() + days)
  return date.toISOString().slice(0, 10)
}

export async function createCourse(cookie: string, overrides: CourseOverrides = {}) {
  const response = await fetch('/api/admin/courses', {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({
      title: 'Truppmann Grundausbildung',
      startsOn: isoInDays(14),
      endsOn: isoInDays(16),
      category: 'grundausbildung',
      format: 'standortausbildung',
      timeLabel: '18:30 – 21:00',
      capacity: 12,
      ...overrides,
    }),
    redirect: 'manual',
  })

  if (response.status !== 201) {
    throw new Error(`Lehrgang konnte nicht angelegt werden (${response.status})`)
  }

  return response.json() as Promise<{ id: string, title: string, updatedAt: number }>
}

export async function createInstructor(cookie: string, name = 'Hauptbrandmeister Krause') {
  const response = await fetch('/api/admin/instructors', {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({ name, role: 'Ausbilder Atemschutz', vita: 'Seit 2009 in der Wehr.' }),
    redirect: 'manual',
  })

  return response.json() as Promise<{ id: string, name: string }>
}
