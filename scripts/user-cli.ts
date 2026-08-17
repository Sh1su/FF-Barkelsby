import { createInterface } from 'node:readline'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { runAccountCommand, type CliIO } from '../server/database/account-cli'
import * as schema from '../server/database/schema'
import { createConnection } from '../server/utils/db'

/**
 * Konto-CLI (FV-12):
 *   npm run user -- list
 *   npm run user -- set-email    <konto> <neue-kennung>
 *   npm run user -- set-password <konto> [--wechsel-erzwingen] [--passwort-stdin]
 *
 * Nur die Verdrahtung – das Verhalten steht in `server/database/account-cli.ts` und ist dort
 * ohne Prozess pruefbar.
 */

/* eslint-disable no-console */

const ENTER = ['\r', '\n']
const ABBRUCH = '\u0003' // Strg-C
const ENDE = '\u0004' // Strg-D
const RUECKTASTE = ['\u007f', '\b']

/**
 * Verdeckte Eingabe: die Frage erscheint, das Getippte nicht.
 *
 * Bewusst direkt auf stdin im Raw-Modus statt ueber readline: `rl.close()` beendet auch
 * `process.stdin`, und ein geteiltes Interface ueber zwei Fragen hinweg blieb bei der zweiten
 * Antwort haengen. Ohne readline gibt es keinen Zustand zwischen den Fragen.
 */
function readPasswordFromTerminal(prompt: string): Promise<string> {
  const stdin = process.stdin

  if (!stdin.isTTY) {
    return Promise.reject(
      new Error(
        'Keine Tastatureingabe möglich (kein Terminal). Für Skripte: '
        + 'echo "…" | npm run user -- set-password <konto> --passwort-stdin',
      ),
    )
  }

  return new Promise((resolve, reject) => {
    process.stdout.write(prompt)
    stdin.setRawMode(true)
    stdin.setEncoding('utf8')
    stdin.resume()

    let eingabe = ''

    const beenden = () => {
      stdin.off('data', onData)
      stdin.setRawMode(false)
      stdin.pause()
      process.stdout.write('\n')
    }

    const onData = (chunk: string) => {
      for (let index = 0; index < chunk.length; index++) {
        const zeichen = chunk[index]!

        if (ENTER.includes(zeichen) || zeichen === ENDE) {
          // Was nach dem Zeilenende im selben Block ankam, gehoert zur naechsten Frage.
          const rest = chunk.slice(index + 1)
          beenden()
          if (rest) stdin.unshift(rest)
          resolve(eingabe)
          return
        }

        if (zeichen === ABBRUCH) {
          beenden()
          reject(new Error('Abgebrochen. Nichts geändert.'))
          return
        }

        if (RUECKTASTE.includes(zeichen)) {
          eingabe = eingabe.slice(0, -1)
          continue
        }

        // Steuerzeichen (Pfeiltasten, Escape-Sequenzen) gehoeren nicht ins Passwort.
        if (zeichen >= ' ') eingabe += zeichen
      }
    }

    stdin.on('data', onData)
  })
}

/** Eine Zeile aus der Standardeingabe, fuer `echo … | npm run user -- … --passwort-stdin`. */
function readPasswordFromStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    const rl = createInterface({ input: process.stdin, terminal: false })
    let erste: string | undefined

    rl.on('line', (zeile) => {
      erste ??= zeile
      rl.close()
    })
    rl.on('close', () => resolve(erste ?? ''))
    rl.on('error', reject)
  })
}

const dbPath = process.env.NUXT_DB_PATH || './data/app.db'
const argv = process.argv.slice(2)
const ausStdin = argv.includes('--passwort-stdin')

const io: CliIO = {
  out: line => console.log(line),
  err: line => console.error(line),
  readPassword: prompt => (ausStdin ? readPasswordFromStdin() : readPasswordFromTerminal(prompt)),
}

const connection = createConnection(dbPath)

try {
  const code = await runAccountCommand(drizzle(connection, { schema }), argv, io, dbPath)
  process.exitCode = code
}
finally {
  connection.close()
}
