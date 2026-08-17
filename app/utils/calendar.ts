/** Reine Kalenderlogik – ohne Vue, damit sie sich direkt testen laesst (FV-3, AC-2/AC-3). */

export interface CalendarDay {
  date: Date
  iso: string
  dayOfMonth: number
  inCurrentMonth: boolean
  isToday: boolean
}

export const WEEKDAY_LABELS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'] as const

export function toIsoDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Monatsraster ab Montag, immer volle Wochen.
 * Tage aus Vor- und Folgemonat bleiben sichtbar, aber als `inCurrentMonth: false` markiert.
 */
export function buildMonthGrid(year: number, month: number, today: Date = new Date()): CalendarDay[] {
  const first = new Date(year, month, 1)
  const offset = (first.getDay() + 6) % 7 // Montag = 0
  const start = new Date(year, month, 1 - offset)

  const todayIso = toIsoDate(today)
  const days: CalendarDay[] = []

  for (let index = 0; index < 42; index++) {
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + index)
    const iso = toIsoDate(date)
    days.push({
      date,
      iso,
      dayOfMonth: date.getDate(),
      inCurrentMonth: date.getMonth() === month,
      isToday: iso === todayIso,
    })
  }

  // Die letzte Woche entfaellt, wenn sie komplett im Folgemonat liegt.
  const lastWeek = days.slice(35)
  return lastWeek.every(day => !day.inCurrentMonth) ? days.slice(0, 35) : days
}

/** Ein mehrtaegiger Lehrgang erscheint an jedem Tag, den er beruehrt (AC-3). */
export function coversDay(
  course: { startsOn: string | number | Date, endsOn: string | number | Date },
  iso: string,
): boolean {
  const start = toIsoDate(new Date(course.startsOn))
  const end = toIsoDate(new Date(course.endsOn))
  return iso >= start && iso <= end
}

export function monthLabel(year: number, month: number): string {
  return new Intl.DateTimeFormat('de-DE', { month: 'long', year: 'numeric' })
    .format(new Date(year, month, 1))
}
