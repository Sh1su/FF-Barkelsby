<script setup lang="ts">
import { getLocalTimeZone, parseDate, type CalendarDate, type DateValue } from '@internationalized/date'

/**
 * Zeitraum-Auswahl mit dem Nuxt-UI-Kalender im Bereichsmodus (FV-14, AC-1/AC-2).
 * Nach aussen bleiben `startsOn`/`endsOn` schlichte ISO-Datumsstrings ("JJJJ-MM-TT") –
 * genau das Format, das `shared/validation/course.ts` erwartet.
 */
const startsOn = defineModel<string>('startsOn', { required: true })
const endsOn = defineModel<string>('endsOn', { required: true })

const tz = getLocalTimeZone()
const df = new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })

function toCalendarDate(iso: string): CalendarDate | undefined {
  if (!iso) return undefined
  try {
    return parseDate(iso)
  }
  catch {
    return undefined
  }
}

const range = computed({
  get: () => ({
    start: toCalendarDate(startsOn.value),
    end: toCalendarDate(endsOn.value),
  }),
  set: (value?: { start?: DateValue, end?: DateValue }) => {
    startsOn.value = value?.start ? value.start.toString() : ''
    // Solange nur der Starttag gesetzt ist (erster Klick), gilt er auch als Ende - ein
    // eintaegiger Lehrgang ist damit ein einziger Klick, kein zwingender zweiter.
    endsOn.value = value?.end ? value.end.toString() : (value?.start ? value.start.toString() : '')
  },
})

const label = computed(() => {
  const { start, end } = range.value
  if (!start) return 'Zeitraum wählen'
  if (!end || start.compare(end) === 0) return df.format(start.toDate(tz))
  return `${df.format(start.toDate(tz))} – ${df.format(end.toDate(tz))}`
})
</script>

<template>
  <UPopover :content="{ align: 'start' }">
    <UButton
      color="neutral"
      variant="outline"
      icon="i-lucide-calendar"
      class="w-full justify-start"
      data-testid="course-date-range-trigger"
    >
      {{ label }}
    </UButton>

    <template #content>
      <UCalendar v-model="range" range class="p-2" data-testid="course-date-range-calendar" />
    </template>
  </UPopover>
</template>
