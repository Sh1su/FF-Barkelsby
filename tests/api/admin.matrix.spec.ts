import { beforeAll, describe, expect, it } from 'vitest'
import { fetch } from '@nuxt/test-utils/e2e'
import { startTestServer } from '../helpers/server'
import { signIn } from '../helpers/session'
import { createCourse } from '../factories/course'

await startTestServer('admin-matrix')

let adminCookie: string
let memberCookie: string

beforeAll(async () => {
  adminCookie = await signIn('admin', '127.0.19.1')
  memberCookie = await signIn('member', '127.0.19.2')
})

function admin(path: string, init: RequestInit = {}, cookie: string | null = adminCookie) {
  return fetch(path, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(cookie ? { cookie } : {}),
      ...(init.headers ?? {}),
    },
    redirect: 'manual',
  })
}

let mitgliedZaehler = 0

async function legeMitgliedAn() {
  mitgliedZaehler += 1
  const response = await admin('/api/admin/members', {
    method: 'POST',
    body: JSON.stringify({
      email: `matrix-mitglied-${mitgliedZaehler}@test.local`,
      displayName: `Matrix Mitglied ${mitgliedZaehler}`,
    }),
  })

  if (response.status !== 201) {
    throw new Error(`Mitgliedskonto konnte nicht angelegt werden (${response.status})`)
  }

  return (await response.json()) as { id: string, email: string, displayName: string }
}

describe('FV-19 Admin-Matrix', () => {
  it('AC-1: weist Unangemeldete mit 401 und Mitglieder mit 403 ab', async () => {
    expect((await admin('/api/admin/matrix', {}, null)).status).toBe(401)
    expect((await admin('/api/admin/matrix', {}, memberCookie)).status).toBe(403)
  })

  it('AC-1: liefert Mitgliedskonten, Lehrgänge und den Abschluss-Status je Paar', async () => {
    const course = await createCourse(adminCookie, { title: 'Matrix-API-Lehrgang' })
    const mitMitAbschluss = await legeMitgliedAn()
    const ohneAbschluss = await legeMitgliedAn()

    const eintrag = await admin(`/api/admin/courses/${course.id}/completions`, {
      method: 'POST',
      body: JSON.stringify({ userId: mitMitAbschluss.id, completedAt: '2024-05-01' }),
    })
    expect(eintrag.status).toBe(201)

    const response = await admin('/api/admin/matrix')
    expect(response.status).toBe(200)

    const matrix = await response.json()

    expect(matrix.courses).toContainEqual({ id: course.id, title: 'Matrix-API-Lehrgang' })
    expect(matrix.members.map((item: { id: string }) => item.id)).toEqual(
      expect.arrayContaining([mitMitAbschluss.id, ohneAbschluss.id]),
    )

    const abschluss = matrix.completions[mitMitAbschluss.id]?.[course.id]
    expect(new Date(abschluss).toISOString().slice(0, 10)).toBe('2024-05-01')

    // Kein Abschluss fuer dieses Paar: der Wert fehlt (sparse Map statt explizitem null,
    // siehe Tech Design in features/FV-19-admin-matrix.md).
    expect(matrix.completions[ohneAbschluss.id]?.[course.id]).toBeUndefined()
  })

  it('AC-1, AC-6: ein deaktiviertes Mitgliedskonto bleibt in der Matrix, aber als inaktiv markiert', async () => {
    const mitglied = await legeMitgliedAn()
    await admin(`/api/admin/users/${mitglied.id}`, { method: 'PATCH', body: JSON.stringify({ active: false }) })

    const response = await admin('/api/admin/matrix')
    const matrix = await response.json()

    expect(matrix.members).toContainEqual(expect.objectContaining({ id: mitglied.id, active: false }))
  })
})
