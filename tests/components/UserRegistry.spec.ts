// @vitest-environment nuxt
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mockNuxtImport, mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import UserRegistry from '../../app/components/admin/UserRegistry.vue'

/**
 * Komponententest zur Kontenliste (FV-7, QA-Befund BUG-7-2).
 * Geprueft werden die Zustaende gefuellt, leer und Fehler sowie die Regeln, die die
 * Oberflaeche selbst durchsetzt: kein Abschalten des Gast-Zugangs, Kennzeichnung des
 * eigenen Kontos und des noch gueltigen Startpassworts.
 */

const GAST = {
  id: 'gast-1',
  email: 'gast@test.local',
  role: 'guest',
  displayName: 'Gast-Zugang',
  mustChangePassword: false,
  active: true,
  createdAt: '2026-08-01T00:00:00.000Z',
}

const ADMIN = {
  id: 'admin-1',
  email: 'wehrfuehrung@test.local',
  role: 'admin',
  displayName: 'Wehrführung',
  mustChangePassword: false,
  active: true,
  createdAt: '2026-08-01T00:00:00.000Z',
}

const VERTRETUNG = {
  id: 'admin-2',
  email: 'vertretung@test.local',
  role: 'admin',
  displayName: 'Vertretung',
  mustChangePassword: true,
  active: false,
  createdAt: '2026-08-02T00:00:00.000Z',
}

// Die Antwort der Route wird je Test umgestellt; `registerEndpoint` laeuft nur einmal.
let antwort: () => unknown = () => ({ items: [], total: 0, page: 1, limit: 25 })

registerEndpoint('/api/admin/users', () => antwort())

mockNuxtImport('useUserSession', () => () => ({
  user: ref({ id: ADMIN.id, email: ADMIN.email, role: 'admin', displayName: ADMIN.displayName }),
}))

describe('FV-7 Benutzerverwaltung – Kontenliste', () => {
  beforeEach(() => {
    // `useFetch` legt seine Antwort unter einem festen Schluessel ab und teilt sie ueber alle
    // Tests der Datei – ohne Leeren des Zwischenspeichers saehe jeder Test die erste Antwort.
    clearNuxtData()
    antwort = () => ({ items: [GAST, ADMIN, VERTRETUNG], total: 3, page: 1, limit: 25 })
  })

  it('AC-1: zeigt Kennung, Name, Rolle und Zustand je Konto', async () => {
    const component = await mountSuspended(UserRegistry)
    const text = component.text()

    expect(component.findAll('[data-testid="user-row"]')).toHaveLength(3)
    expect(text).toContain('gast@test.local')
    expect(text).toContain('Gast-Zugang')
    expect(text).toContain('Verwaltung')
    expect(text).toContain('Aktiv')
    expect(text).toContain('Deaktiviert')
  })

  it('AC-1: markiert ein noch gültiges Startpasswort', async () => {
    const component = await mountSuspended(UserRegistry)
    const zeilen = component.findAll('[data-testid="user-row"]')

    expect(zeilen[2]!.find('[data-testid="user-startpasswort"]').exists()).toBe(true)
    expect(zeilen[1]!.find('[data-testid="user-startpasswort"]').exists()).toBe(false)
  })

  it('AC-7: der Gast-Zugang hat keine Schaltfläche zum Abschalten', async () => {
    const component = await mountSuspended(UserRegistry)
    const zeilen = component.findAll('[data-testid="user-row"]')

    // Reihenfolge der Route: Rolle aufsteigend, also Gast zuerst.
    expect(zeilen[0]!.text()).toContain('gast@test.local')
    expect(zeilen[0]!.find('[data-testid="user-toggle"]').exists()).toBe(false)
    expect(zeilen[1]!.find('[data-testid="user-toggle"]').exists()).toBe(true)
  })

  it('AC-5: ein deaktiviertes Konto bietet "Aktivieren" an', async () => {
    const component = await mountSuspended(UserRegistry)
    const zeilen = component.findAll('[data-testid="user-row"]')

    expect(zeilen[1]!.find('[data-testid="user-toggle"]').text()).toBe('Deaktivieren')
    expect(zeilen[2]!.find('[data-testid="user-toggle"]').text()).toBe('Aktivieren')
  })

  it('AC-6: zählt nur die aktiven Verwaltungskonten', async () => {
    const component = await mountSuspended(UserRegistry)

    expect(component.text()).toContain('1 aktive Verwaltungskonten')
  })

  it('AC-1: der leere Zustand erklärt, dass das nicht vorkommen darf', async () => {
    antwort = () => ({ items: [], total: 0, page: 1, limit: 25 })
    const component = await mountSuspended(UserRegistry)

    expect(component.find('[data-testid="user-empty"]').exists()).toBe(true)
    expect(component.find('table').exists()).toBe(false)
  })

  it('AC-1: ein Fehler der Route wird als Meldung angezeigt, nicht als leere Tabelle', async () => {
    antwort = () => createError({ statusCode: 500, statusMessage: 'Datenbank nicht erreichbar.' })
    const component = await mountSuspended(UserRegistry)

    expect(component.find('[data-testid="user-error"]').exists()).toBe(true)
    expect(component.find('table').exists()).toBe(false)
  })

  it('AC-10: das Passwortfeld ist verdeckt und lässt sich bewusst einblenden', async () => {
    // QA-Befund BUG-7-6: die Liste wird auch am Beamer im Gerätehaus geöffnet.
    const component = await mountSuspended(UserRegistry)

    await component.findAll('[data-testid="user-password"]')[0]!.trigger('click')
    await nextTick()

    const feld = () => document.querySelector('[data-testid="user-password-input"]')
    expect(feld()?.getAttribute('type')).toBe('password')

    const schalter = document.querySelector('[data-testid="user-password-reveal"]') as HTMLElement
    schalter.click()
    await nextTick()

    expect(feld()?.getAttribute('type')).toBe('text')
  })

  it('AC-2: der Anlegen-Dialog nimmt Kennung, Name und Startpasswort auf', async () => {
    const component = await mountSuspended(UserRegistry)

    await component.find('[data-testid="user-new"]').trigger('click')
    await nextTick()

    expect(document.querySelector('[data-testid="user-create-email"]')).not.toBeNull()
    expect(document.querySelector('[data-testid="user-create-name"]')).not.toBeNull()
    expect(document.querySelector('[data-testid="user-create-password"]')?.getAttribute('type'))
      .toBe('password')
  })
})

// Nuxt-Auto-Imports stehen in der Testumgebung zur Verfuegung; vi bleibt fuer mockNuxtImport noetig.
void vi
