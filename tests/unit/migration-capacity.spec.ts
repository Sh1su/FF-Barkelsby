import Database from 'better-sqlite3'
import { describe, expect, it } from 'vitest'
import { applyMigrations, filesystemSource, type MigrationJournal } from '../../server/database/migrate'

/**
 * FV-13, AC-7: Vor der Migration 0002 galt `capacity = 0` als "unbegrenzt". Der neue CHECK
 * verlangt `capacity > 0` – bestehende Lehrgaenge mit 0 muessen deshalb auf 1 angehoben werden,
 * statt die Migration an Altdaten scheitern zu lassen.
 */
describe('FV-13 Lehrgangsfelder reduzieren – Migration', () => {
  it('AC-7: hebt bestehende Lehrgänge mit capacity = 0 auf 1 an, statt zu scheitern', async () => {
    const connection = new Database(':memory:')

    // Nur die ersten beiden Migrationen anwenden – der Stand, auf dem 0002 aufsetzt. Nach
    // Index gefiltert statt nach Tag-Namen ausgeschlossen: sonst rutschen neu hinzugekommene
    // Migrationen (wie 0003, die `capacity` komplett entfernt) versehentlich mit hindurch.
    const fullJournal = (await filesystemSource.journal())!
    const preMigrationSource = {
      journal: async (): Promise<MigrationJournal> => ({
        entries: fullJournal.entries.filter(entry => entry.idx < 2),
      }),
      sql: filesystemSource.sql,
    }
    await applyMigrations(connection, preMigrationSource)

    connection.exec(`
      INSERT INTO courses (id, title, category, format, starts_on, ends_on, capacity)
      VALUES ('unbegrenzt-kurs', 'Alter Lehrgang', 'grundausbildung', 'standortausbildung', 0, 0, 0)
    `)

    // Jetzt die verbleibende Migration (0002) anwenden - aber nicht 0003 (die `capacity`
    // spaeter komplett entfernt, siehe FV-14), sonst gaebe es die Spalte fuer die Probe unten
    // nicht mehr.
    const throughMigration0002 = {
      journal: async (): Promise<MigrationJournal> => ({
        entries: fullJournal.entries.filter(entry => entry.idx <= 2),
      }),
      sql: filesystemSource.sql,
    }
    await applyMigrations(connection, throughMigration0002)

    const row = connection
      .prepare('SELECT capacity FROM courses WHERE id = ?')
      .get('unbegrenzt-kurs') as { capacity: number }

    expect(row.capacity).toBe(1)

    connection.close()
  })
})
