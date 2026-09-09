import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { _resetCryptoKey, decryptSecret, encryptSecret } from '../../server/utils/crypto'

describe('Verschlüsselung von Geheimnissen (Einstellungen, SMTP-Passwort)', () => {
  const originalSecret = process.env.NUXT_SESSION_PASSWORD

  beforeEach(() => {
    process.env.NUXT_SESSION_PASSWORD = 'x'.repeat(32)
    _resetCryptoKey()
  })

  afterEach(() => {
    process.env.NUXT_SESSION_PASSWORD = originalSecret
    _resetCryptoKey()
  })

  it('verschlüsselt und entschlüsselt denselben Klartext wieder', () => {
    const encrypted = encryptSecret('app-spezifisches-passwort')

    expect(encrypted).not.toContain('app-spezifisches-passwort')
    expect(decryptSecret(encrypted)).toBe('app-spezifisches-passwort')
  })

  it('liefert bei jeder Verschlüsselung ein anderes Ergebnis (zufälliger IV)', () => {
    const first = encryptSecret('geheim')
    const second = encryptSecret('geheim')

    expect(first).not.toBe(second)
    expect(decryptSecret(first)).toBe('geheim')
    expect(decryptSecret(second)).toBe('geheim')
  })

  it('lehnt Entschlüsselung mit falschem Schlüssel ab, statt falsche Daten zurückzugeben', () => {
    const encrypted = encryptSecret('geheim')

    process.env.NUXT_SESSION_PASSWORD = 'y'.repeat(32)
    _resetCryptoKey()

    expect(() => decryptSecret(encrypted)).toThrow()
  })

  it('bricht ohne NUXT_SESSION_PASSWORD kontrolliert ab', () => {
    delete process.env.NUXT_SESSION_PASSWORD
    _resetCryptoKey()

    expect(() => encryptSecret('geheim')).toThrow()
  })
})
