import { describe, expect, it } from 'vitest'
import { createPasswordHash, verifyPasswordHash } from '../../server/utils/password'

describe('FV-1 Fundament & Login-Gate – Passwort-Hashing', () => {
  it('AC-7: speichert Passwörter nur als scrypt-Hash, nie im Klartext', async () => {
    const hash = await createPasswordHash('ein-sicheres-passwort')

    expect(hash).toMatch(/^scrypt\$[0-9a-f]{32}\$[0-9a-f]{128}$/)
    expect(hash).not.toContain('ein-sicheres-passwort')
  })

  it('AC-7: erzeugt für dasselbe Passwort unterschiedliche Hashes (Salt)', async () => {
    const first = await createPasswordHash('gleiches-passwort')
    const second = await createPasswordHash('gleiches-passwort')

    expect(first).not.toBe(second)
    expect(await verifyPasswordHash(first, 'gleiches-passwort')).toBe(true)
    expect(await verifyPasswordHash(second, 'gleiches-passwort')).toBe(true)
  })

  it('AC-7: weist ein falsches Passwort ab', async () => {
    const hash = await createPasswordHash('richtiges-passwort')

    expect(await verifyPasswordHash(hash, 'falsches-passwort')).toBe(false)
    expect(await verifyPasswordHash(hash, '')).toBe(false)
  })

  it('AC-7: liefert bei einem kaputten Hash false statt zu werfen', async () => {
    expect(await verifyPasswordHash('kein-hash', 'egal')).toBe(false)
    expect(await verifyPasswordHash('scrypt$zz$zz', 'egal')).toBe(false)
    expect(await verifyPasswordHash('', 'egal')).toBe(false)
  })
})
