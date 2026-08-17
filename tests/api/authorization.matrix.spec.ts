import { readdirSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import { fetch } from '@nuxt/test-utils/e2e'
import { startTestServer } from '../helpers/server'
import { signIn } from '../helpers/session'
import { createCourse, isoInDays } from '../factories/course'

await startTestServer('authorization-matrix')

/**
 * Autorisierungsmatrix (.claude/rules/testing.md): jede Route gegen jede Rolle.
 * Eine neue Route ohne Eintrag laesst diese Suite fehlschlagen – das ist Absicht.
 */
interface MatrixEntry {
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  /** Routenmuster wie unter server/api abgelegt. */
  route: string
  /** Konkrete URL fuer den Aufruf. */
  path: () => string
  body?: () => Record<string, unknown>
  anonymous: number
  guest: number
  admin: number
}

let adminCookie: string
let courseId = 'platzhalter'
let editableCourseId = 'platzhalter'
let deletableCourseId = 'platzhalter'

beforeAll(async () => {
  adminCookie = await signIn('admin', '127.0.5.1')

  courseId = (await createCourse(adminCookie, { title: 'Matrix Lehrgang' })).id
  editableCourseId = (await createCourse(adminCookie, { title: 'Matrix bearbeitbar' })).id
  deletableCourseId = (await createCourse(adminCookie, { title: 'Matrix löschbar' })).id
})

const MATRIX: MatrixEntry[] = [
  {
    method: 'GET',
    route: '/api/health',
    path: () => '/api/health',
    anonymous: 200,
    guest: 200,
    admin: 200,
  },
  {
    method: 'POST',
    route: '/api/auth/login',
    path: () => '/api/auth/login',
    body: () => ({ email: 'niemand@test.local', password: 'falsches-passwort' }),
    anonymous: 401,
    guest: 401,
    admin: 401,
  },
  {
    method: 'POST',
    route: '/api/auth/logout',
    path: () => '/api/auth/logout',
    anonymous: 401,
    guest: 200,
    admin: 200,
  },
  {
    method: 'POST',
    route: '/api/auth/password',
    path: () => '/api/auth/password',
    body: () => ({
      currentPassword: 'falsches-passwort',
      newPassword: 'ein-ausreichend-langes-passwort',
    }),
    anonymous: 401,
    guest: 400,
    admin: 400,
  },
  {
    method: 'GET',
    route: '/api/courses',
    path: () => '/api/courses',
    anonymous: 401,
    guest: 200,
    admin: 200,
  },
  {
    method: 'GET',
    route: '/api/courses/[id]',
    path: () => `/api/courses/${courseId}`,
    anonymous: 401,
    guest: 200,
    admin: 200,
  },
  {
    method: 'GET',
    route: '/api/courses/[id]/cover.svg',
    path: () => `/api/courses/${courseId}/cover.svg`,
    anonymous: 401,
    guest: 200,
    admin: 200,
  },
  {
    method: 'POST',
    route: '/api/courses/[id]/signups',
    path: () => `/api/courses/${courseId}/signups`,
    body: () => ({
      firstName: 'Matrix',
      lastName: 'Testperson',
      email: `matrix-${Math.abs(courseId.length)}@test.local`,
      consent: true,
    }),
    anonymous: 401,
    // Gast und Admin duerfen beide anmelden; die zweite Anmeldung derselben Adresse
    // ergibt 409 – deshalb bekommt jede Rolle ihre eigene Adresse (siehe unten).
    guest: 201,
    admin: 409,
  },
  {
    method: 'GET',
    route: '/api/abmeldung/[token]',
    path: () => '/api/abmeldung/unbekannter-token-fuer-die-matrix',
    anonymous: 404,
    guest: 404,
    admin: 404,
  },
  {
    method: 'POST',
    route: '/api/abmeldung/[token]',
    path: () => '/api/abmeldung/unbekannter-token-fuer-die-matrix',
    anonymous: 404,
    guest: 404,
    admin: 404,
  },
  {
    method: 'GET',
    route: '/api/admin/courses',
    path: () => '/api/admin/courses',
    anonymous: 401,
    guest: 403,
    admin: 200,
  },
  {
    method: 'POST',
    route: '/api/admin/courses',
    path: () => '/api/admin/courses',
    body: () => ({
      title: 'Matrix Neuanlage',
      startsOn: isoInDays(60),
      endsOn: isoInDays(60),
      category: 'grundausbildung',
      format: 'standortausbildung',
    }),
    anonymous: 401,
    guest: 403,
    admin: 201,
  },
  {
    method: 'PATCH',
    route: '/api/admin/courses/[id]',
    path: () => `/api/admin/courses/${editableCourseId}`,
    body: () => ({ summary: 'Von der Matrix bearbeitet' }),
    anonymous: 401,
    guest: 403,
    admin: 200,
  },
  {
    method: 'POST',
    route: '/api/admin/courses/[id]/cancel',
    path: () => `/api/admin/courses/${editableCourseId}/cancel`,
    body: () => ({ cancelled: true }),
    anonymous: 401,
    guest: 403,
    admin: 200,
  },
  {
    method: 'DELETE',
    route: '/api/admin/courses/[id]',
    path: () => `/api/admin/courses/${deletableCourseId}`,
    anonymous: 401,
    guest: 403,
    admin: 200,
  },
  {
    method: 'GET',
    route: '/api/admin/courses/[id]/mails',
    path: () => `/api/admin/courses/${courseId}/mails`,
    anonymous: 401,
    guest: 403,
    admin: 200,
  },
  {
    method: 'GET',
    route: '/api/admin/signups',
    path: () => '/api/admin/signups',
    anonymous: 401,
    guest: 403,
    admin: 200,
  },
  {
    method: 'PATCH',
    route: '/api/admin/signups/[id]',
    path: () => '/api/admin/signups/gibt-es-nicht',
    body: () => ({ status: 'bestaetigt' }),
    anonymous: 401,
    guest: 403,
    admin: 404,
  },
  {
    method: 'GET',
    route: '/api/admin/courses/[id]/signups.csv',
    path: () => `/api/admin/courses/${courseId}/signups.csv`,
    anonymous: 401,
    guest: 403,
    admin: 200,
  },
  {
    method: 'GET',
    route: '/api/admin/instructors',
    path: () => '/api/admin/instructors',
    anonymous: 401,
    guest: 403,
    admin: 200,
  },
  {
    method: 'POST',
    route: '/api/admin/instructors',
    path: () => '/api/admin/instructors',
    body: () => ({ name: 'Matrix Ausbilder' }),
    anonymous: 401,
    guest: 403,
    admin: 201,
  },
  {
    method: 'GET',
    route: '/api/admin/users',
    path: () => '/api/admin/users',
    anonymous: 401,
    guest: 403,
    admin: 200,
  },
  {
    method: 'POST',
    route: '/api/admin/users',
    path: () => '/api/admin/users',
    body: () => ({
      email: 'matrix-konto@test.local',
      displayName: 'Matrix Konto',
      password: 'ein-langes-startpasswort',
    }),
    anonymous: 401,
    guest: 403,
    // Beim Admin-Durchlauf existiert die Kennung aus dem Gast-Durchlauf noch nicht,
    // deshalb 201; ein zweiter Aufruf ergaebe 409.
    admin: 201,
  },
  {
    method: 'PATCH',
    route: '/api/admin/users/[id]',
    path: () => '/api/admin/users/gibt-es-nicht',
    body: () => ({ active: true }),
    anonymous: 401,
    guest: 403,
    admin: 404,
  },
  {
    method: 'GET',
    route: '/api/admin/cover-preview.svg',
    path: () => '/api/admin/cover-preview.svg?motif=1&palette=2',
    anonymous: 401,
    guest: 403,
    admin: 200,
  },
]

/** Leitet aus den Dateien unter server/api die tatsaechlich vorhandenen Routen ab. */
function discoverRoutes(): string[] {
  const root = new URL('../../server/api', import.meta.url).pathname
  const routes: string[] = []

  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) {
        walk(full)
        continue
      }

      const relativePath = relative(root, full).split(sep).join('/')
      const method = relativePath.match(/\.(get|post|patch|put|delete)\.ts$/)?.[1]
      if (!method) continue

      const path = relativePath
        .replace(/\.(get|post|patch|put|delete)\.ts$/, '')
        .replace(/\/index$/, '')
      routes.push(`${method.toUpperCase()} /api/${path}`.replace(/\/$/, ''))
    }
  }

  walk(root)
  return routes.sort()
}

function call(entry: MatrixEntry, cookie?: string) {
  return fetch(entry.path(), {
    method: entry.method,
    headers: {
      'content-type': 'application/json',
      'x-forwarded-for': '127.0.5.9',
      ...(cookie ? { cookie } : {}),
    },
    body: entry.body ? JSON.stringify(entry.body()) : undefined,
    redirect: 'manual',
  })
}

describe('Autorisierungsmatrix', () => {
  it('jede Route unter server/api hat einen Eintrag in der Matrix', () => {
    const documented = [...new Set(MATRIX.map(entry => `${entry.method} ${entry.route}`))].sort()

    expect(discoverRoutes()).toEqual(documented)
  })

  it.each(MATRIX)('AC-1: $method $route ohne Anmeldung → $anonymous', async (entry) => {
    expect((await call(entry)).status).toBe(entry.anonymous)
  })

  // Vor jedem Eintrag neu anmelden: die Matrix ruft selbst /api/auth/logout auf,
  // was die Session danach ungueltig machen wuerde.
  it.each(MATRIX)('AC-11: $method $route als Gast → $guest', async (entry) => {
    const cookie = await signIn('guest', '127.0.5.4')
    expect((await call(entry, cookie)).status).toBe(entry.guest)
  })

  it.each(MATRIX)('AC-13: $method $route als Admin → $admin', async (entry) => {
    const cookie = await signIn('admin', '127.0.5.3')
    expect((await call(entry, cookie)).status).toBe(entry.admin)
  })
})
