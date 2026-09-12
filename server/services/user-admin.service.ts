import { randomUUID } from 'node:crypto'
import { and, asc, count, eq, isNull } from 'drizzle-orm'
import type { UserRole } from '../../shared/constants'
import { users } from '../database/schema'

/**
 * Benutzerverwaltung (FV-7).
 *
 * Eine Schutzregel steht ueber allem: es bleibt immer mindestens ein handlungsfaehiger
 * Admin uebrig. Bis FV-15 gab es daneben einen zweiten Sonderfall fuer das eine geteilte
 * Gast-Konto – seit persoenliche Mitgliedskonten das abloesen, laesst sich jedes
 * Mitgliedskonto wie jedes andere Konto deaktivieren.
 */

export interface AccountView {
  id: string
  email: string
  role: UserRole
  displayName: string
  mustChangePassword: boolean
  active: boolean
  createdAt: Date
}

/**
 * Reine Regel, damit sie ohne Datenbank pruefbar ist (FV-7, AC-6; FV-15, AC-4).
 *
 * Ein Mitgliedskonto zaehlt nicht zu den Admin-Konten und faellt deshalb nie unter die
 * Admin-Mindestzahl – es laesst sich also immer deaktivieren.
 */
export function darfDeaktivieren(
  konto: { role: UserRole },
  aktiveAdmins: number,
): { erlaubt: boolean, grund?: string } {
  if (konto.role !== 'admin') {
    return { erlaubt: true }
  }

  if (aktiveAdmins <= 1) {
    return {
      erlaubt: false,
      grund: 'Das ist das letzte aktive Verwaltungskonto – sonst käme niemand mehr in die Verwaltung.',
    }
  }

  return { erlaubt: true }
}

export interface AccountListQuery {
  page: number
  limit: number
  /** FV-16, AC-5: Liste auf eine Rolle eingrenzen, z.B. um nur Mitglieder anzuzeigen. */
  role?: UserRole
}

export interface AccountList {
  items: AccountView[]
  total: number
  page: number
  limit: number
}

/**
 * Kontenliste, seitenweise (.claude/rules/backend.md: jede Liste mit hartem Limit).
 *
 * Seit FV-15 bekommt jedes Mitglied ein eigenes Konto – die Tabelle waechst also mit der
 * Wehr, das harte Limit ist hier kein reiner Formalismus mehr wie zu Zeiten des einen
 * geteilten Gast-Kontos.
 */
export function listAccounts(query: AccountListQuery = { page: 1, limit: 25 }): AccountList {
  const db = useDatabase()
  const filter = query.role ? eq(users.role, query.role) : undefined

  const items = db
    .select({
      id: users.id,
      email: users.email,
      role: users.role,
      displayName: users.displayName,
      mustChangePassword: users.mustChangePassword,
      deactivatedAt: users.deactivatedAt,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(filter)
    .orderBy(asc(users.role), asc(users.email))
    .limit(query.limit)
    .offset((query.page - 1) * query.limit)
    .all()
    .map(({ deactivatedAt, ...rest }) => ({ ...rest, active: deactivatedAt === null }))

  const total = db.select({ value: count() }).from(users).where(filter).get()?.value ?? 0

  return { items, total, page: query.page, limit: query.limit }
}

/** Ein einzelnes Konto in derselben Form wie in der Liste – ohne Hash (AC-10). */
function accountView(id: string): AccountView {
  const { deactivatedAt, ...rest } = useDatabase()
    .select({
      id: users.id,
      email: users.email,
      role: users.role,
      displayName: users.displayName,
      mustChangePassword: users.mustChangePassword,
      deactivatedAt: users.deactivatedAt,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.id, id))
    .get()!

  return { ...rest, active: deactivatedAt === null }
}

export function countActiveAdmins(): number {
  return useDatabase()
    .select({ value: count() })
    .from(users)
    .where(and(eq(users.role, 'admin'), isNull(users.deactivatedAt)))
    .get()?.value ?? 0
}

function accountOrThrow(id: string) {
  const konto = useDatabase().select().from(users).where(eq(users.id, id)).get()
  if (!konto) {
    throw createError({ statusCode: 404, statusMessage: 'Konto nicht gefunden.' })
  }
  return konto
}

function assertEmailFrei(email: string, exceptId?: string) {
  const bestehend = useDatabase()
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .get()

  if (bestehend && bestehend.id !== exceptId) {
    throw createError({ statusCode: 409, statusMessage: 'Diese Kennung ist bereits vergeben.' })
  }
}

/** Legt ein weiteres Admin-Konto an (FV-7, AC-2). */
export async function createAdminAccount(input: {
  email: string
  displayName: string
  password: string
}): Promise<AccountView> {
  assertEmailFrei(input.email)

  const id = randomUUID()

  useDatabase()
    .insert(users)
    .values({
      id,
      email: input.email,
      passwordHash: await createPasswordHash(input.password),
      role: 'admin',
      displayName: input.displayName,
      // Das Startpasswort kennt die Wehrfuehrung – der neue Admin muss es wechseln.
      mustChangePassword: true,
    })
    .run()

  return accountView(id)
}

/**
 * Legt ein Mitgliedskonto an (FV-16, AC-1 bis AC-3).
 *
 * Anders als `createAdminAccount` ist `password` optional: fehlt es, erzeugt der Server eines
 * und gibt es einmalig zurueck (`generatedPassword`) – ein zweites Mal ist es nirgends
 * abrufbar, auch nicht ueber diese Funktion (der Hash laesst sich nicht umkehren).
 */
export async function createMemberAccount(input: {
  email: string
  displayName: string
  password?: string
}): Promise<{ account: AccountView, generatedPassword?: string }> {
  assertEmailFrei(input.email)

  const generatedPassword = input.password ? undefined : generatePassword()
  const password = input.password ?? generatedPassword!

  const id = randomUUID()

  useDatabase()
    .insert(users)
    .values({
      id,
      email: input.email,
      passwordHash: await createPasswordHash(password),
      role: 'member',
      displayName: input.displayName,
      // Wer immer das Startpasswort kennt (Admin oder Server-Zufall) – das Mitglied selbst
      // kennt es noch nicht, also Wechsel beim ersten Anmelden erzwingen.
      mustChangePassword: true,
    })
    .run()

  return { account: accountView(id), generatedPassword }
}

export interface UpdateAccountInput {
  email?: string
  password?: string
  displayName?: string
  active?: boolean
}

/**
 * Kennung, Passwort oder Zustand aendern (FV-7, AC-3 bis AC-7, AC-12).
 *
 * `actorId` ist das Konto, das die Aenderung vornimmt – es entscheidet darueber, ob ein
 * gesetztes Passwort einen Zwangswechsel nach sich zieht.
 */
export async function updateAccount(
  id: string,
  input: UpdateAccountInput,
  actorId?: string,
): Promise<AccountView> {
  const konto = accountOrThrow(id)
  const db = useDatabase()

  if (input.email && input.email !== konto.email) {
    assertEmailFrei(input.email, id)
  }

  if (input.active === false) {
    const regel = darfDeaktivieren(konto, countActiveAdmins())
    if (!regel.erlaubt) {
      throw createError({ statusCode: 422, statusMessage: regel.grund })
    }
  }

  const aenderungen: Record<string, unknown> = { updatedAt: new Date() }

  if (input.email) aenderungen.email = input.email
  if (input.displayName) aenderungen.displayName = input.displayName

  if (input.password) {
    aenderungen.passwordHash = await createPasswordHash(input.password)
    // Wer ein Passwort für jemand anderen setzt, kennt es – deshalb Wechsel erzwingen (AC-12).
    // Das eigene Passwort hat man sich selbst ausgedacht: kein Zwangswechsel beim nächsten
    // Anmelden, sonst dreht sich die Wehrführung im Kreis (QA-Befund BUG-7-4).
    aenderungen.mustChangePassword = id !== actorId
  }

  if (input.active !== undefined) {
    aenderungen.deactivatedAt = input.active ? null : new Date()
  }

  db.update(users).set(aenderungen).where(eq(users.id, id)).run()

  return accountView(id)
}
