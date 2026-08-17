import { randomUUID } from 'node:crypto'
import { and, asc, count, eq, isNull } from 'drizzle-orm'
import type { UserRole } from '../../shared/constants'
import { users } from '../database/schema'

/**
 * Benutzerverwaltung (FV-7).
 *
 * Zwei Schutzregeln stehen ueber allem: es bleibt immer mindestens ein handlungsfaehiger
 * Admin uebrig, und das geteilte Gast-Konto verschwindet nie – sonst kaeme die Wehr nicht
 * mehr an die Lehrgangsuebersicht.
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

/** Reine Regel, damit sie ohne Datenbank pruefbar ist (FV-7, AC-6/AC-7). */
export function darfDeaktivieren(
  konto: { role: UserRole },
  aktiveAdmins: number,
): { erlaubt: boolean, grund?: string } {
  if (konto.role === 'guest') {
    return {
      erlaubt: false,
      grund: 'Der Gast-Zugang wird gebraucht, damit die Wehr die Lehrgänge sieht. '
        + 'Er lässt sich nur ändern, nicht abschalten.',
    }
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
 * Die Tabelle bleibt hier klein – ein Gast-Konto und eine Handvoll Admins –, das Limit ist
 * also weniger Schutz als Gleichlauf mit den uebrigen Listen-Endpunkten.
 */
export function listAccounts(query: AccountListQuery = { page: 1, limit: 25 }): AccountList {
  const db = useDatabase()

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
    .orderBy(asc(users.role), asc(users.email))
    .limit(query.limit)
    .offset((query.page - 1) * query.limit)
    .all()
    .map(({ deactivatedAt, ...rest }) => ({ ...rest, active: deactivatedAt === null }))

  const total = db.select({ value: count() }).from(users).get()?.value ?? 0

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
