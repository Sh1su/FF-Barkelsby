import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createConnection } from '../../server/utils/db'
import { applyMigrations } from '../../server/database/migrate'
import { readSeedEnv, seedAccounts } from '../../server/database/seed'
import * as schema from '../../server/database/schema'
import { users } from '../../server/database/schema'
import { verifyPasswordHash } from '../../server/utils/password'

const ACCOUNTS = {
  adminEmail: 'wehrfuehrung@test.local',
  adminPassword: 'start-admin-passwort',
  guestEmail: 'gast@test.local',
  guestPassword: 'start-gast-passwort',
}

describe('FV-1 Fundament & Login-Gate – Seed', () => {
  let dir: string
  let connection: ReturnType<typeof createConnection>
  let db: ReturnType<typeof drizzle<typeof schema>>

  beforeEach(async () => {
    dir = mkdtempSync(join(tmpdir(), 'fireedu-seed-'))
    connection = createConnection(join(dir, 'test.db'))
    db = drizzle(connection, { schema })
    await applyMigrations(connection)
  })

  afterEach(() => {
    connection.close()
    rmSync(dir, { recursive: true, force: true })
  })

  it('AC-9: legt genau ein Gast- und ein Admin-Konto an', async () => {
    await seedAccounts(db, ACCOUNTS)

    const rows = db.select().from(users).all()
    expect(rows).toHaveLength(2)
    expect(rows.filter(row => row.role === 'admin')).toHaveLength(1)
    expect(rows.filter(row => row.role === 'guest')).toHaveLength(1)
  })

  it('AC-9: ist idempotent und überschreibt geänderte Passwörter nicht', async () => {
    await seedAccounts(db, ACCOUNTS)

    // Der Admin ändert sein Passwort, danach startet der Container erneut.
    db.update(users)
      .set({ passwordHash: await import('../../server/utils/password').then(m => m.createPasswordHash('selbst-gewaehltes-passwort')), mustChangePassword: false })
      .run()

    const created = await seedAccounts(db, ACCOUNTS)

    expect(created).toHaveLength(0)
    expect(db.select().from(users).all()).toHaveLength(2)

    const admin = db.select().from(users).all().find(row => row.role === 'admin')!
    expect(await verifyPasswordHash(admin.passwordHash, 'selbst-gewaehltes-passwort')).toBe(true)
    expect(admin.mustChangePassword).toBe(false)
  })

  it('AC-10: legt Konten mit erzwungenem Passwortwechsel an', async () => {
    await seedAccounts(db, ACCOUNTS)

    for (const row of db.select().from(users).all()) {
      expect(row.mustChangePassword).toBe(true)
    }
  })

  it('AC-9: bricht bei fehlenden Umgebungsvariablen mit klarer Meldung ab', () => {
    expect(() => readSeedEnv({})).toThrowError(/NUXT_ADMIN_EMAIL/)
    expect(() => readSeedEnv({ NUXT_ADMIN_EMAIL: 'a@b.c' })).toThrowError(/NUXT_GUEST_PASSWORD/)
  })
})
