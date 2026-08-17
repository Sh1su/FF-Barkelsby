import { describe, expect, it } from 'vitest'
import { mailConfigFromEnv, toMailConfig } from '../../server/utils/mailer'

describe('FV-4 E-Mail-Infrastruktur – Konfiguration', () => {
  it('AC-1: ohne Host oder Absender gilt der Versand als nicht konfiguriert', () => {
    expect(toMailConfig({})).toBeNull()
    expect(toMailConfig({ host: 'smtp.example.org' })).toBeNull()
    expect(toMailConfig({ from: 'a@b.c' })).toBeNull()
    expect(toMailConfig({ host: '   ', from: 'a@b.c' })).toBeNull()
  })

  it('AC-2: liest ein vollständiges Relay aus der Umgebung (Beispiel Gmail)', () => {
    const config = mailConfigFromEnv({
      NUXT_SMTP_HOST: 'smtp.gmail.com',
      NUXT_SMTP_PORT: '587',
      NUXT_SMTP_USER: 'wehr@gmail.com',
      NUXT_SMTP_PASSWORD: 'app-passwort',
      NUXT_SMTP_FROM: 'wehr@gmail.com',
    } as NodeJS.ProcessEnv)

    expect(config).toEqual({
      host: 'smtp.gmail.com',
      port: 587,
      user: 'wehr@gmail.com',
      password: 'app-passwort',
      from: 'wehr@gmail.com',
    })
  })

  it('AC-2: eine unsinnige Portangabe fällt auf 587 zurück (Beispiel IONOS)', () => {
    const config = mailConfigFromEnv({
      NUXT_SMTP_HOST: 'smtp.ionos.de',
      NUXT_SMTP_PORT: 'keine-zahl',
      NUXT_SMTP_FROM: 'lehrgaenge@wehr.example',
    } as NodeJS.ProcessEnv)

    expect(config?.port).toBe(587)
  })

  it('AC-9: die Konfiguration enthält keine weiteren Felder, die versehentlich geloggt werden', () => {
    const config = toMailConfig({ host: 'smtp.example.org', from: 'a@b.c', password: 'geheim' })

    expect(Object.keys(config!).sort()).toEqual(['from', 'host', 'password', 'port', 'user'])
  })
})
