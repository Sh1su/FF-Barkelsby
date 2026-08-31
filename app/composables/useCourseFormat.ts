/** Deutsche Datums- und Zeitformate (Intl, de-DE) fuer Karten und Detailseite. */
const dayMonth = new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit' })
const fullDate = new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
const monthShort = new Intl.DateTimeFormat('de-DE', { month: 'short' })
const weekdayShort = new Intl.DateTimeFormat('de-DE', { weekday: 'short' })

export function useCourseFormat() {
  const toDate = (value: string | number | Date) => new Date(value)

  /** "12.09.2026" oder "12.09. – 14.09.2026" bei mehrtaegigen Lehrgaengen. */
  function dateRange(start: string | number | Date, end: string | number | Date): string {
    const from = toDate(start)
    const to = toDate(end)

    if (from.toDateString() === to.toDateString()) return fullDate.format(from)

    // `dayMonth` liefert bereits "12.09." – ein weiterer Punkt ergaebe "12.09.."
    return `${dayMonth.format(from)} – ${fullDate.format(to)}`
  }

  function dayBadge(start: string | number | Date) {
    const date = toDate(start)
    return {
      day: String(date.getDate()).padStart(2, '0'),
      month: monthShort.format(date).replace('.', ''),
      weekday: weekdayShort.format(date).replace('.', ''),
    }
  }

  function durationLabel(start: string | number | Date, end: string | number | Date): string {
    const from = toDate(start)
    const to = toDate(end)
    const days = Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1
    return days <= 1 ? 'Ein Tag' : `${days} Tage`
  }

  function seatsLabel(capacity: number, confirmedCount: number): string {
    return `${confirmedCount} von ${capacity} Plätzen belegt`
  }

  return { dateRange, dayBadge, durationLabel, seatsLabel, fullDate }
}
