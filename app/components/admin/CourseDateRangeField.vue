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

// Eigener Zustand fuer den Kalender statt eines computed get/set direkt auf startsOn/endsOn:
// UCalendar haelt beim ersten Klick bewusst `end: undefined`, um am zweiten Klick zu erkennen,
// dass der bestehende Bereich erweitert werden soll statt ein neuer Ein-Tages-Bereich zu
// beginnen. Ein computed, das `endsOn` sofort auf den Starttag zurueckspiegelt (siehe unten),
// haette genau dieses `end: undefined` bei jedem Lesezugriff wieder ueberschrieben - der
// Kalender haette die Auswahl dann faelschlich schon nach dem ersten Klick fuer abgeschlossen
// gehalten und jeder weitere Klick nur einen neuen Ein-Tages-Bereich eroeffnet, nie erweitert.
const range = shallowRef<{ start: DateValue | undefined, end: DateValue | undefined }>({
  start: toCalendarDate(startsOn.value),
  end: toCalendarDate(endsOn.value),
})

// Merkt sich den zuletzt selbst nach aussen geschriebenen Wert, um die eigene Widerspiegelung
// unten (startsOn/endsOn -> range) nicht mit einer echten externen Aenderung zu verwechseln.
let lastEmitted: { start: string, end: string } | null = null

watch(range, (value) => {
  const start = value?.start ? value.start.toString() : ''
  // Solange nur der Starttag gesetzt ist (erster Klick), gilt er auch als Ende - ein
  // eintaegiger Lehrgang ist damit ein einziger Klick, kein zwingender zweiter.
  const end = value?.end ? value.end.toString() : start
  lastEmitted = { start, end }
  startsOn.value = start
  endsOn.value = end
})

// startsOn/endsOn koennen auch von aussen gesetzt werden (Klick auf einen Kalendertag in der
// Schnellanlage, geladene Daten auf der Bearbeiten-Seite) - dann den Kalenderzustand nachziehen.
watch([startsOn, endsOn], ([start, end]) => {
  if (lastEmitted && lastEmitted.start === start && lastEmitted.end === end) return
  range.value = { start: toCalendarDate(start), end: toCalendarDate(end) }
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
