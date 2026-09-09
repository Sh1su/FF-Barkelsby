import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto'

/**
 * Verschluesselt Geheimnisse, die in der Datenbank landen (aktuell: das SMTP-Passwort aus der
 * Einstellungen-Seite). SQLite hat kein eigenes Verschluesselungsfeature, also AES-256-GCM mit
 * einem aus `NUXT_SESSION_PASSWORD` abgeleiteten Schluessel – dieselbe Variable, die schon fuer
 * die Session-Cookies verlangt wird (`server/plugins/bootstrap.ts` prueft dort auf mindestens 32
 * Zeichen), damit kein zusaetzliches Geheimnis verwaltet werden muss.
 */

let cachedKey: Buffer | undefined

function deriveKey(): Buffer {
  if (cachedKey) return cachedKey

  const secret = process.env.NUXT_SESSION_PASSWORD
  if (!secret || secret.length < 32) {
    // Bewusst ein einfacher Error statt createError() – dieselbe Pruefung wie beim Serverstart
    // (server/plugins/bootstrap.ts), unabhaengig vom Nitro-Request-Kontext testbar.
    throw new Error('NUXT_SESSION_PASSWORD fehlt oder ist kürzer als 32 Zeichen. Siehe .env.example.')
  }

  cachedKey = scryptSync(secret, 'ff-barkelsby-settings-v1', 32)
  return cachedKey
}

/** Nur fuer Tests: erzwingt beim naechsten Aufruf eine neue Schluesselableitung. */
export function _resetCryptoKey(): void {
  cachedKey = undefined
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', deriveKey(), iv)
  const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return Buffer.concat([iv, authTag, ciphertext]).toString('base64')
}

export function decryptSecret(encoded: string): string {
  const raw = Buffer.from(encoded, 'base64')
  const iv = raw.subarray(0, 12)
  const authTag = raw.subarray(12, 28)
  const ciphertext = raw.subarray(28)

  const decipher = createDecipheriv('aes-256-gcm', deriveKey(), iv)
  decipher.setAuthTag(authTag)
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8')
}
