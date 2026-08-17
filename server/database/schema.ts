import { sql } from 'drizzle-orm'
import { check, index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'
import {
  CATEGORIES,
  COURSE_STATUSES,
  FORMATS,
  MAIL_STATUSES,
  SIGNUP_STATUSES,
  USER_ROLES,
} from '../../shared/constants'

const timestamps = {
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
}

/** Zugang zum System. Genau ein geteiltes Gast-Konto, dazu persoenliche Admin-Konten. */
export const users = sqliteTable(
  'users',
  {
    id: text('id').primaryKey(),
    email: text('email').notNull(),
    passwordHash: text('password_hash').notNull(),
    role: text('role', { enum: USER_ROLES }).notNull(),
    displayName: text('display_name').notNull(),
    mustChangePassword: integer('must_change_password', { mode: 'boolean' })
      .notNull()
      .default(false),
    deactivatedAt: integer('deactivated_at', { mode: 'timestamp' }),
    ...timestamps,
  },
  table => [
    uniqueIndex('users_email_unique').on(table.email),
    check('users_role_check', sql`${table.role} in ('guest', 'admin')`),
  ],
)

/**
 * Serverseitige Sperrliste fuer abgemeldete Sessions (FV-1, AC-12).
 *
 * Die Session steckt in einem versiegelten Cookie – ohne diese Liste bliebe ein bereits
 * kopiertes Cookie bis zum Ablauf gueltig. Bewusst pro Session (`sid`) und nicht pro Konto:
 * das Gast-Konto ist geteilt, ein kontoweites Verwerfen wuerde die ganze Wehr abmelden.
 */
export const revokedSessions = sqliteTable(
  'revoked_sessions',
  {
    sid: text('sid').primaryKey(),
    expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
    createdAt: timestamps.createdAt,
  },
  table => [index('revoked_sessions_expires_at_idx').on(table.expiresAt)],
)

/** Ausbilder mit Portraet-Motiv, Rolle und Vita – auf der Detailseite sichtbar. */
export const instructors = sqliteTable('instructors', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  role: text('role'),
  vita: text('vita'),
  motif: integer('motif'),
  ...timestamps,
})

export const courses = sqliteTable(
  'courses',
  {
    id: text('id').primaryKey(),
    title: text('title').notNull(),
    summary: text('summary'),
    description: text('description'),
    topics: text('topics', { mode: 'json' }).$type<string[]>(),
    category: text('category', { enum: CATEGORIES }).notNull(),
    format: text('format', { enum: FORMATS }).notNull(),
    startsOn: integer('starts_on', { mode: 'timestamp' }).notNull(),
    endsOn: integer('ends_on', { mode: 'timestamp' }).notNull(),
    timeLabel: text('time_label'),
    location: text('location'),
    /** 0 = unbegrenzt. Sonst Zahl der Plaetze; belegt zaehlt nur bestaetigte Anmeldungen. */
    capacity: integer('capacity').notNull().default(0),
    instructorId: text('instructor_id').references(() => instructors.id, { onDelete: 'set null' }),
    motif: integer('motif'),
    palette: integer('palette'),
    status: text('status', { enum: COURSE_STATUSES }).notNull().default('geplant'),
    ...timestamps,
  },
  table => [
    index('courses_starts_on_idx').on(table.startsOn),
    index('courses_category_starts_on_idx').on(table.category, table.startsOn),
    index('courses_ends_on_idx').on(table.endsOn),
    check(
      'courses_category_check',
      sql`${table.category} in ('grundausbildung', 'atemschutz', 'technische-hilfeleistung', 'fuehrung-organisation', 'erste-hilfe')`,
    ),
    check(
      'courses_format_check',
      sql`${table.format} in ('standortausbildung', 'kreisausbildung')`,
    ),
    check('courses_status_check', sql`${table.status} in ('geplant', 'abgesagt')`),
    check('courses_capacity_check', sql`${table.capacity} >= 0`),
    check('courses_dates_check', sql`${table.endsOn} >= ${table.startsOn}`),
  ],
)

/** Programm eines Lehrgangs, ein Datensatz je Tag. */
export const courseDays = sqliteTable(
  'course_days',
  {
    id: text('id').primaryKey(),
    courseId: text('course_id')
      .notNull()
      .references(() => courses.id, { onDelete: 'cascade' }),
    dayNumber: integer('day_number').notNull(),
    date: integer('date', { mode: 'timestamp' }),
    timeLabel: text('time_label'),
    title: text('title').notNull(),
    bullets: text('bullets', { mode: 'json' }).$type<string[]>(),
    ...timestamps,
  },
  table => [uniqueIndex('course_days_course_day_unique').on(table.courseId, table.dayNumber)],
)

/**
 * Protokoll aller ausgeloesten E-Mails (FV-4).
 *
 * Ohne konfiguriertes SMTP-Relay laeuft die Anwendung weiter und schreibt hier
 * `nicht_versendet` – so bleibt nachvollziehbar, welche Nachricht faellig gewesen waere.
 * Enthaelt bewusst keine Zugangsdaten und keinen Nachrichtentext.
 */
export const mailLog = sqliteTable(
  'mail_log',
  {
    id: text('id').primaryKey(),
    courseId: text('course_id').references(() => courses.id, { onDelete: 'set null' }),
    signupId: text('signup_id'),
    recipient: text('recipient').notNull(),
    template: text('template').notNull(),
    subject: text('subject').notNull(),
    status: text('status', { enum: MAIL_STATUSES }).notNull(),
    error: text('error'),
    sentAt: integer('sent_at', { mode: 'timestamp' }),
    ...timestamps,
  },
  table => [
    index('mail_log_course_idx').on(table.courseId),
    index('mail_log_created_at_idx').on(table.createdAt),
    check(
      'mail_log_status_check',
      sql`${table.status} in ('versendet', 'nicht_versendet', 'fehlgeschlagen')`,
    ),
  ],
)

/**
 * Interessensbekundung ohne persoenliches Konto (PRD, Q13/Q22).
 *
 * Die Schreib-API entsteht in FV-5. FV-3 liest die Tabelle bereits: die Belegung zaehlt
 * bestaetigte Anmeldungen, und ein Lehrgang mit Anmeldungen darf nicht geloescht werden.
 */
export const signups = sqliteTable(
  'signups',
  {
    id: text('id').primaryKey(),
    courseId: text('course_id')
      .notNull()
      .references(() => courses.id, { onDelete: 'cascade' }),
    firstName: text('first_name').notNull(),
    lastName: text('last_name').notNull(),
    email: text('email').notNull(),
    status: text('status', { enum: SIGNUP_STATUSES }).notNull().default('offen'),
    /** Zufallstoken fuer den Abmelde-Link in jeder E-Mail (PRD, Q20). */
    cancelToken: text('cancel_token').notNull(),
    consentAt: integer('consent_at', { mode: 'timestamp' }),
    ...timestamps,
  },
  table => [
    // Doppelte Anmeldung derselben Adresse blocken – stornierte ausgenommen (PRD, Q22).
    uniqueIndex('signups_course_email_unique')
      .on(table.courseId, table.email)
      .where(sql`${table.status} <> 'storniert'`),
    uniqueIndex('signups_cancel_token_unique').on(table.cancelToken),
    index('signups_course_status_idx').on(table.courseId, table.status),
    check(
      'signups_status_check',
      sql`${table.status} in ('offen', 'bestaetigt', 'abgelehnt', 'storniert')`,
    ),
  ],
)
