import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { runAccountCommand, parseCommand, type CliIO } from '../../server/database/account-cli'
import { applyMigrations } from '../../server/database/migrate'
import * as schema from '../../server/database/schema'
import { users } from '../../server/database/schema'
import { seedAccounts } from '../../server/database/seed'
import { createConnection } from '../../server/utils/db'
import { createPasswordHash, verifyPasswordHash } from '../../server/utils/password'

const ACCOUNTS = {
  adminEmail: 'wehrfuehrung@test.local',
  adminPassword: 'start-admin-passwort',
  guestEmail: 'gast@test.local',
  guestPassword: 'start-gast-passwort',
}

/** Sammelt die Ausgabe und liefert vorgegebene Passworteingaben der Reihe nach. */
function fakeIO(passwoerter: string[] = []) {
  const out: string[] = []
  const err: string[] = []
  const prompts: string[] = []
  const warteschlange = [...passwoerter]

  const io: CliIO = {
    out: line => void out.push(line),
    err: line => void err.push(line),
    readPassword: async (prompt) => {
      prompts.push(prompt)
      return warteschlange.shift() ?? ''
    },
  }

  return {
    io,
    out,
    err,
    prompts,
    /** Alles, was auf dem Bildschirm erschienen wäre. */
    alles: () => [...out, ...err].join('\n'),
  }
}

describe('FV-12 Konto-CLI – Kennung und Passwort ohne Anmeldung', () => {
  let dir: string
  let connection: ReturnType<typeof createConnection>
  let db: ReturnType<typeof drizzle<typeof schema>>
  let dbPath: string

  const konto = (email: string) => db.select().from(users).where(eq(users.email, email)).get()

  beforeEach(async () => {
    dir = mkdtempSync(join(tmpdir(), 'fireedu-cli-'))
    dbPath = join(dir, 'test.db')
    connection = createConnection(dbPath)
    db = drizzle(connection, { schema })
    await applyMigrations(connection)
    await seedAccounts(db, ACCOUNTS)
  })

  afterEach(() => {
    connection.close()
    rmSync(dir, { recursive: true, force: true })
  })

  it('AC-1: listet alle Konten mit Kennung, Rolle, Zustand und Wechselhinweis', async () => {
    db.update(users)
      .set({ deactivatedAt: new Date() })
      .where(eq(users.email, ACCOUNTS.adminEmail))
      .run()

    const { io, out } = fakeIO()
    const code = await runAccountCommand(db, ['list'], io, dbPath)

    expect(code).toBe(0)
    const ausgabe = out.join('\n')
    expect(ausgabe).toContain(ACCOUNTS.adminEmail)
    expect(ausgabe).toContain(ACCOUNTS.guestEmail)
    expect(ausgabe).toContain('admin')
    expect(ausgabe).toContain('guest')
    expect(ausgabe).toContain('deaktiviert')
    expect(ausgabe).toContain('aktiv')
    expect(ausgabe).toContain('Passwortwechsel fällig')
  })

  it('AC-2: ändert die Kennung und normalisiert Leerzeichen und Großschreibung', async () => {
    const { io } = fakeIO()
    const code = await runAccountCommand(
      db,
      ['set-email', 'guest', '  GAST-NEU@Example.ORG '],
      io,
      dbPath,
    )

    expect(code).toBe(0)
    expect(konto('gast-neu@example.org')?.role).toBe('guest')
    expect(konto(ACCOUNTS.guestEmail)).toBeUndefined()
  })

  it('AC-2: nimmt auch die Kennung selbst als Konto entgegen', async () => {
    const { io } = fakeIO()
    const code = await runAccountCommand(
      db,
      ['set-email', ACCOUNTS.adminEmail.toUpperCase(), 'chefin@test.local'],
      io,
      dbPath,
    )

    expect(code).toBe(0)
    expect(konto('chefin@test.local')?.role).toBe('admin')
  })

  it('AC-3: lehnt eine bereits vergebene Kennung ab und lässt beide Konten unverändert', async () => {
    const { io, err } = fakeIO()
    const code = await runAccountCommand(
      db,
      ['set-email', 'admin', ACCOUNTS.guestEmail],
      io,
      dbPath,
    )

    expect(code).toBe(1)
    expect(err.join('\n')).toContain('bereits vergeben')
    expect(konto(ACCOUNTS.adminEmail)?.role).toBe('admin')
    expect(konto(ACCOUNTS.guestEmail)?.role).toBe('guest')
  })

  it('AC-4: fragt das Passwort zweimal verdeckt ab', async () => {
    const { io, prompts } = fakeIO(['ein-langes-passwort', 'ein-langes-passwort'])
    const code = await runAccountCommand(db, ['set-password', 'guest'], io, dbPath)

    expect(code).toBe(0)
    expect(prompts).toHaveLength(2)
    expect(prompts[1]).toContain('wiederholen')
  })

  it('AC-4: bricht ab, wenn die Bestätigung abweicht', async () => {
    const { io, err } = fakeIO(['ein-langes-passwort', 'vertippt-passwort-x'])
    const code = await runAccountCommand(db, ['set-password', 'guest'], io, dbPath)

    expect(code).toBe(1)
    expect(err.join('\n')).toContain('nicht überein')
    expect(
      await verifyPasswordHash(konto(ACCOUNTS.guestEmail)!.passwordHash, ACCOUNTS.guestPassword),
    ).toBe(true)
  })

  it('AC-4: liest mit --passwort-stdin genau einmal, ohne Rückfrage', async () => {
    const { io, prompts } = fakeIO(['aus-der-standardeingabe'])
    const code = await runAccountCommand(
      db,
      ['set-password', 'guest', '--passwort-stdin'],
      io,
      dbPath,
    )

    expect(code).toBe(0)
    expect(prompts).toHaveLength(1)
    expect(
      await verifyPasswordHash(konto(ACCOUNTS.guestEmail)!.passwordHash, 'aus-der-standardeingabe'),
    ).toBe(true)
  })

  it('AC-4: nimmt ein Passwort als Argument nicht entgegen', async () => {
    const { io, err } = fakeIO()
    const code = await runAccountCommand(
      db,
      ['set-password', 'guest', 'geheim-und-lang-genug'],
      io,
      dbPath,
    )

    expect(code).toBe(1)
    expect(err.join('\n')).toContain('nicht als Argument')
    expect(err.join('\n')).toContain('--passwort-stdin')
    expect(
      await verifyPasswordHash(konto(ACCOUNTS.guestEmail)!.passwordHash, ACCOUNTS.guestPassword),
    ).toBe(true)
  })

  it('AC-5: lehnt Passwörter unter 12 Zeichen ab und lässt das Konto unverändert', async () => {
    const { io, err } = fakeIO(['elf-zeichen', 'elf-zeichen'])
    const code = await runAccountCommand(db, ['set-password', 'guest'], io, dbPath)

    expect(code).toBe(1)
    expect(err.join('\n')).toContain('mindestens 12 Zeichen')
    expect(
      await verifyPasswordHash(konto(ACCOUNTS.guestEmail)!.passwordHash, ACCOUNTS.guestPassword),
    ).toBe(true)
  })

  it('AC-6: setzt das Passwort sofort gültig und ohne erzwungenen Wechsel', async () => {
    const { io } = fakeIO(['frisches-passwort-123', 'frisches-passwort-123'])
    const code = await runAccountCommand(db, ['set-password', 'guest'], io, dbPath)

    expect(code).toBe(0)
    const gast = konto(ACCOUNTS.guestEmail)!
    expect(await verifyPasswordHash(gast.passwordHash, 'frisches-passwort-123')).toBe(true)
    expect(await verifyPasswordHash(gast.passwordHash, ACCOUNTS.guestPassword)).toBe(false)
    expect(gast.mustChangePassword).toBe(false)
  })

  it('AC-6: erzwingt den Wechsel mit --wechsel-erzwingen', async () => {
    db.update(users).set({ mustChangePassword: false }).run()

    const { io } = fakeIO(['frisches-passwort-123', 'frisches-passwort-123'])
    const code = await runAccountCommand(
      db,
      ['set-password', 'guest', '--wechsel-erzwingen'],
      io,
      dbPath,
    )

    expect(code).toBe(0)
    expect(konto(ACCOUNTS.guestEmail)?.mustChangePassword).toBe(true)
  })

  it('AC-7: trifft über die Kurzformen guest und admin genau ein Konto', async () => {
    const { io } = fakeIO()
    expect(await runAccountCommand(db, ['set-email', 'guest', 'g@test.local'], io, dbPath)).toBe(0)
    expect(await runAccountCommand(db, ['set-email', 'admin', 'a@test.local'], io, dbPath)).toBe(0)

    expect(konto('g@test.local')?.role).toBe('guest')
    expect(konto('a@test.local')?.role).toBe('admin')
  })

  it('AC-7: bricht bei mehreren Admin-Konten mit der Liste der Kennungen ab', async () => {
    db.insert(users)
      .values({
        id: randomUUID(),
        email: 'vertretung@test.local',
        passwordHash: await createPasswordHash('zweites-admin-passwort'),
        role: 'admin',
        displayName: 'Vertretung',
      })
      .run()

    const { io, err } = fakeIO()
    const code = await runAccountCommand(db, ['set-email', 'admin', 'neu@test.local'], io, dbPath)

    expect(code).toBe(1)
    const meldung = err.join('\n')
    expect(meldung).toContain(ACCOUNTS.adminEmail)
    expect(meldung).toContain('vertretung@test.local')
    expect(konto('neu@test.local')).toBeUndefined()
  })

  it('AC-8: weist einen unbekannten Befehl mit Hilfetext zurück', async () => {
    const { io, err } = fakeIO()
    const code = await runAccountCommand(db, ['set-mail', 'guest', 'x@test.local'], io, dbPath)

    expect(code).toBe(1)
    expect(err.join('\n')).toContain('Unbekannter Befehl: set-mail')
    expect(err.join('\n')).toContain('npm run user -- set-email')
  })

  it('AC-8: weist ein unbekanntes Konto zurück, ohne etwas zu schreiben', async () => {
    const { io, err } = fakeIO()
    const code = await runAccountCommand(
      db,
      ['set-email', 'niemand@test.local', 'x@test.local'],
      io,
      dbPath,
    )

    expect(code).toBe(1)
    expect(err.join('\n')).toContain('Kein Konto mit der Kennung')
    expect(db.select().from(users).all()).toHaveLength(2)
  })

  it('AC-8: weist fehlende Angaben und unbekannte Optionen zurück', () => {
    expect(parseCommand([])).toMatchObject({ kind: 'usage-error' })
    expect(parseCommand(['set-email', 'guest'])).toMatchObject({ kind: 'usage-error' })
    expect(parseCommand(['list', 'zuviel'])).toMatchObject({ kind: 'usage-error' })
    expect(parseCommand(['set-password', 'guest', '--was-auch-immer'])).toMatchObject({
      kind: 'usage-error',
    })
    expect(parseCommand(['list'])).toEqual({ kind: 'list' })
  })

  it('AC-9: gibt weder Passwort noch Hash aus – auch nicht im Fehlerfall', async () => {
    const erfolg = fakeIO(['sichtbar-waere-schlecht', 'sichtbar-waere-schlecht'])
    await runAccountCommand(db, ['set-password', 'guest'], erfolg.io, dbPath)

    const fehler = fakeIO(['zu-kurz', 'zu-kurz'])
    await runAccountCommand(db, ['set-password', 'guest'], fehler.io, dbPath)

    const liste = fakeIO()
    await runAccountCommand(db, ['list'], liste.io, dbPath)

    for (const ausgabe of [erfolg.alles(), fehler.alles(), liste.alles()]) {
      expect(ausgabe).not.toContain('sichtbar-waere-schlecht')
      expect(ausgabe).not.toContain('zu-kurz')
      expect(ausgabe).not.toContain('scrypt$')
    }
  })

  it('AC-10: verweist auf db:migrate, wenn die Datenbank nicht eingerichtet ist', async () => {
    const leerDir = mkdtempSync(join(tmpdir(), 'fireedu-cli-leer-'))
    const leerPfad = join(leerDir, 'leer.db')
    const leereVerbindung = createConnection(leerPfad)

    try {
      const { io, err } = fakeIO()
      const code = await runAccountCommand(
        drizzle(leereVerbindung, { schema }),
        ['list'],
        io,
        leerPfad,
      )

      expect(code).toBe(1)
      expect(err.join('\n')).toContain('db:migrate')
      expect(err.join('\n')).toContain(leerPfad)
    }
    finally {
      leereVerbindung.close()
      rmSync(leerDir, { recursive: true, force: true })
    }
  })

  it('AC-1: ist über npm run user erreichbar (Verdrahtung von Skript und Modul)', () => {
    const ausgabe = execFileSync(
      'npx',
      ['tsx', resolve('scripts/user-cli.ts'), 'list'],
      { env: { ...process.env, NUXT_DB_PATH: dbPath }, encoding: 'utf8' },
    )

    expect(ausgabe).toContain(ACCOUNTS.guestEmail)
    expect(ausgabe).toContain(ACCOUNTS.adminEmail)
    expect(ausgabe).not.toContain('scrypt$')
  })
})
