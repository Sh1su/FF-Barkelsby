<script setup lang="ts">
interface CalendarCourse {
  id: string
  title: string
  startsOn: string | number | Date
  endsOn: string | number | Date
  status: 'geplant' | 'abgesagt'
}

const props = defineProps<{ courses: CalendarCourse[], year: number, month: number }>()
const emit = defineEmits<{
  'update:year': [value: number]
  'update:month': [value: number]
  'select-day': [iso: string]
}>()

const grid = computed(() => buildMonthGrid(props.year, props.month))
const label = computed(() => monthLabel(props.year, props.month))

function coursesOn(iso: string) {
  return props.courses.filter(course => coversDay(course, iso))
}

function shift(delta: number) {
  const date = new Date(props.year, props.month + delta, 1)
  emit('update:year', date.getFullYear())
  emit('update:month', date.getMonth())
}

function goToday() {
  const now = new Date()
  emit('update:year', now.getFullYear())
  emit('update:month', now.getMonth())
}
</script>

<template>
  <section data-testid="course-calendar">
    <div class="flex flex-wrap items-center gap-2">
      <UButton
        variant="outline"
        color="neutral"
        data-testid="calendar-today"
        @click="goToday"
      >
        Heute
      </UButton>
      <UButton
        icon="i-lucide-chevron-left"
        variant="ghost"
        color="neutral"
        aria-label="Vorheriger Monat"
        data-testid="calendar-prev"
        @click="shift(-1)"
      />
      <UButton
        icon="i-lucide-chevron-right"
        variant="ghost"
        color="neutral"
        aria-label="Nächster Monat"
        data-testid="calendar-next"
        @click="shift(1)"
      />
      <h2 class="text-lg font-semibold text-highlighted" data-testid="calendar-label">
        {{ label }}
      </h2>
      <p class="ml-auto text-sm text-muted">
        Klick auf einen Tag → neuen Lehrgang anlegen
      </p>
    </div>

    <div class="mt-4 grid grid-cols-7 gap-px rounded-lg border border-default bg-accented text-sm">
      <div
        v-for="weekday in WEEKDAY_LABELS"
        :key="weekday"
        class="bg-muted px-2 py-2 text-center text-xs font-semibold uppercase tracking-wide text-muted"
      >
        {{ weekday }}
      </div>

      <button
        v-for="day in grid"
        :key="day.iso"
        type="button"
        class="min-h-24 bg-default p-2 text-left align-top transition hover:bg-elevated"
        :class="[
          !day.inCurrentMonth && 'text-dimmed',
          day.isToday && 'ring-2 ring-inset ring-fire-600',
        ]"
        :data-testid="`calendar-day-${day.iso}`"
        :aria-label="`${day.dayOfMonth}. – neuen Lehrgang anlegen`"
        @click="emit('select-day', day.iso)"
      >
        <span class="text-xs font-semibold">{{ day.dayOfMonth }}</span>

        <span
          v-for="course in coursesOn(day.iso)"
          :key="course.id"
          class="mt-1 block truncate rounded px-1.5 py-0.5 text-[11px]"
          :class="course.status === 'abgesagt'
            ? 'bg-elevated text-dimmed line-through'
            : 'bg-fire-600/10 text-fire-700'"
          data-testid="calendar-event"
        >
          {{ course.title }}
        </span>
      </button>
    </div>
  </section>
</template>
