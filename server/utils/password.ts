import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: Buffer,
  keylen: number,
) => Promise<Buffer>

const KEY_LENGTH = 64

/**
 * Passwort-Hash im Format `scrypt$<salt-hex>$<hash-hex>`.
 *
 * Bewusst eine eigene duenne Huelle um node:crypto statt der Auto-Imports von
 * nuxt-auth-utils: der Seed laeuft auch als CLI-Skript (`npm run db:seed`) und in
 * Unit-Tests, wo Nitro-Auto-Imports nicht zur Verfuegung stehen.
 */
export async function createPasswordHash(password: string): Promise<string> {
  const salt = randomBytes(16)
  const derived = await scryptAsync(password, salt, KEY_LENGTH)
  return `scrypt$${salt.toString('hex')}$${derived.toString('hex')}`
}

/**
 * Zufaelliges Startpasswort fuer neu angelegte Mitgliedskonten (FV-16, AC-2).
 *
 * base64url statt eines Zeichensatzes mit Sonderzeichen: laesst sich anstandslos abtippen oder
 * kopieren, ohne dass Verwechslungsgefahr (0/O, l/1) oder Escaping-Probleme entstehen. 20 Byte
 * Zufall ergeben 27 Zeichen – deutlich ueber `PASSWORD_MIN_LENGTH`.
 */
export function generatePassword(byteLength = 20): string {
  return randomBytes(byteLength).toString('base64url')
}

/** Prueft ein Passwort gegen einen Hash. Gibt bei kaputtem Hash `false` zurueck, wirft nie. */
export async function verifyPasswordHash(hash: string, password: string): Promise<boolean> {
  const [algorithm, saltHex, keyHex] = hash.split('$')
  if (algorithm !== 'scrypt' || !saltHex || !keyHex) return false

  try {
    const derived = await scryptAsync(password, Buffer.from(saltHex, 'hex'), KEY_LENGTH)
    const expected = Buffer.from(keyHex, 'hex')
    if (expected.length !== derived.length) return false
    return timingSafeEqual(derived, expected)
  }
  catch {
    return false
  }
}
