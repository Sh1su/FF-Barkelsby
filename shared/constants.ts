/** Von Client und Server gemeinsam genutzte Stammdaten. In v1 bewusst nicht pflegbar (PRD, Q15). */

export const USER_ROLES = ['guest', 'admin'] as const
export type UserRole = (typeof USER_ROLES)[number]

export const CATEGORIES = [
  'grundausbildung',
  'atemschutz',
  'technische-hilfeleistung',
  'fuehrung-organisation',
  'erste-hilfe',
] as const
export type Category = (typeof CATEGORIES)[number]

export const CATEGORY_LABELS: Record<Category, string> = {
  'grundausbildung': 'Grundausbildung',
  'atemschutz': 'Atemschutz',
  'technische-hilfeleistung': 'Technische Hilfeleistung',
  'fuehrung-organisation': 'Führung & Organisation',
  'erste-hilfe': 'Erste Hilfe / Sanitätsdienst',
}

export const FORMATS = ['standortausbildung', 'kreisausbildung'] as const
export type Format = (typeof FORMATS)[number]

export const FORMAT_LABELS: Record<Format, string> = {
  standortausbildung: 'Standortausbildung',
  kreisausbildung: 'Kreisausbildung',
}

export const COURSE_STATUSES = ['geplant', 'abgesagt'] as const
export type CourseStatus = (typeof COURSE_STATUSES)[number]

/** Statusmaschine der Interessensbekundung (PRD, Q13). */
export const SIGNUP_STATUSES = ['offen', 'bestaetigt', 'abgelehnt', 'storniert'] as const
export type SignupStatus = (typeof SIGNUP_STATUSES)[number]

export const SIGNUP_STATUS_LABELS: Record<SignupStatus, string> = {
  offen: 'Offen',
  bestaetigt: 'Bestätigt',
  abgelehnt: 'Abgelehnt',
  storniert: 'Storniert',
}

/** Status einer protokollierten E-Mail (FV-4). */
export const MAIL_STATUSES = ['versendet', 'nicht_versendet', 'fehlgeschlagen'] as const
export type MailStatus = (typeof MAIL_STATUSES)[number]

/** Zeitlimit fuer den Verbindungsversuch zum Relay – der Auftrag darf nicht daran haengen. */
export const SMTP_TIMEOUT_MS = 10_000

/** Sessiondauer je Rolle (PRD, Q10). */
export const SESSION_MAX_AGE_SECONDS: Record<UserRole, number> = {
  guest: 60 * 60 * 24 * 30,
  admin: 60 * 60 * 8,
}

/** Mindestlaenge fuer Passwoerter, serverseitig geprueft. */
export const PASSWORD_MIN_LENGTH = 12

/** Interessensbekundungen je IP und Zeitfenster (FV-5, AC-10). */
export const SIGNUP_RATE_LIMIT = {
  maxAttempts: 20,
  windowMs: 15 * 60 * 1000,
} as const

/** Anmeldeversuche je IP und Zeitfenster (PRD, Q10). Konten werden nie gesperrt. */
export const LOGIN_RATE_LIMIT = {
  maxAttempts: 10,
  windowMs: 15 * 60 * 1000,
} as const
