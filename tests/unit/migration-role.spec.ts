import Database from 'better-sqlite3'
import { describe, expect, it } from 'vitest'
import { applyMigrations, filesystemSource, type MigrationJournal } from '../../server/database/migrate'

/**
 * FV-15, AC-2/AC-3: Vor der Migration 0007 hiess die Rolle des einen geteilten Zugangs
 * "guest". Bestehende Zeilen muessen auf "member" umgeschrieben werden, bevor der
 * verschaerfte CHECK ("member", "admin") aktiv wird – sonst scheitert die Migration an
 * Altdaten, genau wie bei FV-13s `capacity`-Anhebung.
 */
describe('FV-15 Persönliche Mitgliedskonten – Migration', () => {
  it('AC-2: schreibt bestehende Konten mit role = guest auf role = member um', async () => {
    const connection = new Database(':memory:')

    // Nur die Migrationen bis vor 0007 anwenden – der Stand, auf dem 0007 aufsetzt.
    const fullJournal = (await filesystemSource.journal())!
    const preMigrationSource = {
      journal: async (): Promise<MigrationJournal> => ({
        entries: fullJournal.entries.filter(entry => entry.idx < 7),
      }),
      sql: filesystemSource.sql,
    }
    await applyMigrations(connection, preMigrationSource)

    connection.exec(`
      INSERT INTO users (id, email, password_hash, role, display_name, must_change_password)
      VALUES ('altes-gast-konto', 'gast@alt.local', 'hash', 'guest', 'Gast-Zugang', 0)
    `)

    const throughMigration0007 = {
      journal: async (): Promise<MigrationJournal> => ({
        entries: fullJournal.entries.filter(entry => entry.idx <= 7),
      }),
      sql: filesystemSource.sql,
    }
    await applyMigrations(connection, throughMigration0007)

    const row = connection
      .prepare('SELECT role FROM users WHERE id = ?')
      .get('altes-gast-konto') as { role: string }

    expect(row.role).toBe('member')

    connection.close()
  })

  it('AC-1: der neue CHECK lehnt role = guest ab', async () => {
    const connection = new Database(':memory:')
    await applyMigrations(connection)

    expect(() =>
      connection.exec(`
        INSERT INTO users (id, email, password_hash, role, display_name, must_change_password)
        VALUES ('neuversuch', 'neu@test.local', 'hash', 'guest', 'Versuch', 0)
      `),
    ).toThrowError(/CHECK constraint failed/)

    connection.close()
  })
})
