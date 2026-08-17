import { asc, eq, sql } from 'drizzle-orm'
import { updateUserSchema } from '../../shared/validation/user'
import type { AppDatabase } from '../utils/db'
import { createPasswordHash } from '../utils/password'
import { users } from './schema'

/**
 * Konto-CLI (FV-12): Kennung und Passwort setzen, ohne angemeldet zu sein.
 *
 * Das ganze Verhalten steht hier und bekommt Datenbank und Ein-/Ausgabe hereingereicht –
 * `scripts/user-cli.ts` ist nur die Verdrahtung. Dadurch ist alles bis hin zur Passwortabfrage
 * pruefbar, ohne einen Prozess zu starten (Vorbild: `seed.ts` + `scripts/seed-cli.ts`).
 *
 * Bewusst NICHT ueber `server/services/user-admin.service.ts`: der Service ruft die
 * Nitro-Auto-Imports `useDatabase()` und `createError()` auf, die es in einem tsx-Skript nicht
 * gibt. Geteilt bleibt die fachliche Wahrheit – Zod-Schema, Hash-Funktion, Unique-Index.
 */

export interface CliIO {
  out: (line: string) => void
  err: (line: string) => void
  /** Fragt ein Passwort verdeckt ab. Wird pro Aufruf einmal je Eingabe gerufen. */
  readPassword: (prompt: string) => Promise<string>
}

export const USAGE = `Konten verwalten (FV-12)

  npm run user -- list
  npm run user -- set-email    <konto> <neue-kennung>
  npm run user -- set-password <konto> [--wechsel-erzwingen] [--passwort-stdin]

<konto> ist eine Kennung (E-Mail), "guest" oder "admin".
Die Datenbank kommt aus NUXT_DB_PATH (Vorgabe ./data/app.db).`

export type Command =
  | { kind: 'list' }
  | { kind: 'set-email', selector: string, email: string }
  | { kind: 'set-password', selector: string, forceChange: boolean, fromStdin: boolean }
  | { kind: 'usage-error', message: string }

/**
 * Argumente auswerten. Reine Funktion ohne Datenbank – der Grossteil der Fehlbedienung
 * faellt hier auf, bevor irgendetwas geoeffnet wird.
 */
export function parseCommand(argv: string[]): Command {
  const flags = argv.filter(argument => argument.startsWith('--'))
  const positional = argv.filter(argument => !argument.startsWith('--'))
  const [command, ...rest] = positional

  const unknownFlag = flags.find(
    flag => !['--wechsel-erzwingen', '--passwort-stdin'].includes(flag),
  )
  if (unknownFlag) {
    return { kind: 'usage-error', message: `Unbekannte Option: ${unknownFlag}` }
  }

  switch (command) {
    case 'list':
      if (rest.length > 0) {
        return { kind: 'usage-error', message: '"list" nimmt keine weiteren Angaben entgegen.' }
      }
      return { kind: 'list' }

    case 'set-email': {
      const [selector, email, ...zuviel] = rest
      if (!selector || !email || zuviel.length > 0) {
        return {
          kind: 'usage-error',
          message: 'Erwartet: set-email <konto> <neue-kennung>',
        }
      }
      return { kind: 'set-email', selector, email }
    }

    case 'set-password': {
      const [selector, ...zuviel] = rest
      if (!selector) {
        return { kind: 'usage-error', message: 'Erwartet: set-password <konto>' }
      }
      // Ein Passwort als Argument stuende in der Shell-Historie und in der Prozessliste –
      // deshalb wird es hier abgelehnt statt stillschweigend uebernommen.
      if (zuviel.length > 0) {
        return {
          kind: 'usage-error',
          message: 'Das Passwort wird nicht als Argument entgegengenommen – es stünde in der '
            + 'Shell-Historie und in der Prozessliste. Ohne weitere Angabe wird es verdeckt '
            + 'abgefragt, für Skripte gibt es --passwort-stdin.',
        }
      }
      return {
        kind: 'set-password',
        selector,
        forceChange: flags.includes('--wechsel-erzwingen'),
        fromStdin: flags.includes('--passwort-stdin'),
      }
    }

    case undefined:
      return { kind: 'usage-error', message: 'Kein Befehl angegeben.' }

    default:
      return { kind: 'usage-error', message: `Unbekannter Befehl: ${command}` }
  }
}

/** Abbruch mit einer Meldung, die so auf dem Bildschirm landen darf – ohne Stacktrace. */
class CliAbbruch extends Error {}

/**
 * Ist die Datenbank ueberhaupt eingerichtet? `createConnection()` legt eine leere Datei an,
 * ohne diese Pruefung kaeme sonst ein "no such table: users" statt eines brauchbaren Hinweises.
 */
function assertSchemaVorhanden(db: AppDatabase, dbPath: string) {
  const vorhanden = db.get(
    sql`select name from sqlite_master where type = 'table' and name = 'users'`,
  )

  if (!vorhanden) {
    throw new CliAbbruch(
      `Keine eingerichtete Datenbank unter ${dbPath}. Zuerst "npm run db:migrate" ausführen.`,
    )
  }
}

/** Kennung normalisieren – exakt wie in der Anwendung (Kleinschreibung, getrimmt). */
function normalisiereKennung(eingabe: string): string {
  const geprueft = updateUserSchema.safeParse({ email: eingabe })
  if (!geprueft.success) {
    throw new CliAbbruch(geprueft.error.issues[0]!.message)
  }
  return geprueft.data.email!
}

function pruefePasswort(eingabe: string): string {
  const geprueft = updateUserSchema.safeParse({ password: eingabe })
  if (!geprueft.success) {
    throw new CliAbbruch(geprueft.error.issues[0]!.message)
  }
  return geprueft.data.password!
}

type Konto = typeof users.$inferSelect

/**
 * Konto anhand von Kennung oder Rolle finden.
 *
 * `admin` ist nur eine Bequemlichkeit fuer den Regelfall mit einem einzigen Verwaltungskonto.
 * Sobald es mehrere gibt (FV-7 erlaubt das ausdruecklich), waere die Kurzform eine Wette –
 * dann bricht sie mit der Liste der Kennungen ab, statt irgendeines zu treffen.
 */
export function resolveAccount(db: AppDatabase, selector: string): Konto {
  if (selector === 'guest' || selector === 'admin') {
    const treffer = db
      .select()
      .from(users)
      .where(eq(users.role, selector))
      .orderBy(asc(users.email))
      .all()

    if (treffer.length === 0) {
      throw new CliAbbruch(`Kein Konto mit der Rolle "${selector}" vorhanden.`)
    }
    if (treffer.length > 1) {
      const kennungen = treffer.map(konto => `  ${konto.email}`).join('\n')
      throw new CliAbbruch(
        `Es gibt ${treffer.length} Konten mit der Rolle "${selector}". `
        + `Bitte die Kennung angeben:\n${kennungen}`,
      )
    }
    return treffer[0]!
  }

  const email = normalisiereKennung(selector)
  const konto = db.select().from(users).where(eq(users.email, email)).get()

  if (!konto) {
    throw new CliAbbruch(`Kein Konto mit der Kennung "${email}" gefunden.`)
  }
  return konto
}

const ZUSTAND = { aktiv: 'aktiv', deaktiviert: 'deaktiviert' } as const

function list(db: AppDatabase, io: CliIO) {
  const konten = db
    .select({
      email: users.email,
      role: users.role,
      displayName: users.displayName,
      mustChangePassword: users.mustChangePassword,
      deactivatedAt: users.deactivatedAt,
    })
    .from(users)
    .orderBy(asc(users.role), asc(users.email))
    .all()

  if (konten.length === 0) {
    io.out('Keine Konten vorhanden. "npm run db:seed" legt Gast-Zugang und Erst-Admin an.')
    return
  }

  const breite = Math.max(...konten.map(konto => konto.email.length), 'Kennung'.length)
  io.out(`${'Kennung'.padEnd(breite)}  Rolle  Zustand      Hinweis`)

  for (const konto of konten) {
    const zustand = konto.deactivatedAt === null ? ZUSTAND.aktiv : ZUSTAND.deaktiviert
    const hinweis = konto.mustChangePassword ? 'Passwortwechsel fällig' : ''
    io.out(
      `${konto.email.padEnd(breite)}  ${konto.role.padEnd(5)}  ${zustand.padEnd(11)}  ${hinweis}`.trimEnd(),
    )
  }
}

/** Uebersetzt den Unique-Index `users_email_unique` in eine Meldung fuer Menschen. */
function istKennungVergeben(fehler: unknown): boolean {
  return fehler instanceof Error && /UNIQUE constraint failed: users\.email/.test(fehler.message)
}

function setEmail(db: AppDatabase, konto: Konto, eingabe: string, io: CliIO) {
  const email = normalisiereKennung(eingabe)

  if (email === konto.email) {
    io.out(`Unverändert: ${konto.email} trägt diese Kennung bereits.`)
    return
  }

  try {
    db.update(users)
      .set({ email, updatedAt: new Date() })
      .where(eq(users.id, konto.id))
      .run()
  }
  catch (fehler) {
    if (istKennungVergeben(fehler)) {
      throw new CliAbbruch('Diese Kennung ist bereits vergeben.')
    }
    throw fehler
  }

  io.out(`Kennung geändert: ${konto.email} → ${email}`)
}

async function setPassword(
  db: AppDatabase,
  konto: Konto,
  passwortEingabe: string,
  forceChange: boolean,
  io: CliIO,
) {
  const passwort = pruefePasswort(passwortEingabe)

  db.update(users)
    .set({
      passwordHash: await createPasswordHash(passwort),
      // Ohne Flag kein Zwangswechsel: der Betreiber setzt das Passwort bewusst und gibt es so
      // heraus. Beim geteilten Gast-Zugang waere ein Zwangswechsel sogar schaedlich – der erste
      // Anmelder wuerde es fuer die ganze Wehr aendern.
      mustChangePassword: forceChange,
      updatedAt: new Date(),
    })
    .where(eq(users.id, konto.id))
    .run()

  io.out(`Passwort gesetzt für ${konto.email}.`)
  io.out(
    forceChange
      ? 'Das Konto muss das Passwort beim nächsten Anmelden wechseln.'
      : 'Es gilt sofort; ein Passwortwechsel wird nicht erzwungen.',
  )
}

/**
 * Einstiegspunkt der CLI. Gibt den Exit-Code zurueck: 0 = erledigt, 1 = abgebrochen.
 * Wirft nicht – jeder erwartbare Fehler wird zu einer deutschen Zeile auf `io.err`.
 */
export async function runAccountCommand(
  db: AppDatabase,
  argv: string[],
  io: CliIO,
  dbPath = process.env.NUXT_DB_PATH || './data/app.db',
): Promise<number> {
  const command = parseCommand(argv)

  if (command.kind === 'usage-error') {
    io.err(command.message)
    io.err('')
    io.err(USAGE)
    return 1
  }

  try {
    assertSchemaVorhanden(db, dbPath)

    if (command.kind === 'list') {
      list(db, io)
      return 0
    }

    const konto = resolveAccount(db, command.selector)

    if (command.kind === 'set-email') {
      setEmail(db, konto, command.email, io)
      return 0
    }

    const passwort = command.fromStdin
      ? await io.readPassword('')
      : await frageNeuesPasswort(io)

    await setPassword(db, konto, passwort, command.forceChange, io)
    return 0
  }
  catch (fehler) {
    if (fehler instanceof CliAbbruch) {
      io.err(fehler.message)
      return 1
    }
    // Unerwartetes bleibt kurz: die Meldung koennte Datenbankinhalte tragen, der Stacktrace
    // hilft auf einem Server niemandem.
    io.err(`Abgebrochen: ${fehler instanceof Error ? fehler.message : String(fehler)}`)
    return 1
  }
}

async function frageNeuesPasswort(io: CliIO): Promise<string> {
  const erste = await io.readPassword('Neues Passwort: ')
  const zweite = await io.readPassword('Zur Kontrolle wiederholen: ')

  if (erste !== zweite) {
    throw new CliAbbruch('Die beiden Eingaben stimmen nicht überein. Nichts geändert.')
  }
  return erste
}
