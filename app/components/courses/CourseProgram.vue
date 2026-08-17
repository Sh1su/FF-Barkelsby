<script setup lang="ts">
interface CourseDay {
  id: string
  dayNumber: number
  date: string | number | Date | null
  timeLabel: string | null
  title: string
  bullets: string[] | null
}

defineProps<{ days: CourseDay[] }>()

const { fullDate } = useCourseFormat()
</script>

<template>
  <section data-testid="course-program">
    <h2 class="text-lg font-semibold text-highlighted">
      Programm
    </h2>

    <ol class="mt-4 space-y-4">
      <li
        v-for="day in days"
        :key="day.id"
        class="rounded-lg border border-default bg-default p-5"
      >
        <div class="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span class="text-sm font-semibold uppercase tracking-wide text-fire-600">
            Tag {{ day.dayNumber }}
          </span>
          <span v-if="day.date" class="text-sm text-toned">
            {{ fullDate.format(new Date(day.date)) }}
          </span>
          <span v-if="day.timeLabel" class="text-sm text-muted">
            {{ day.timeLabel }}
          </span>
        </div>

        <h3 class="mt-1 text-base font-medium text-highlighted">
          {{ day.title }}
        </h3>

        <ul v-if="day.bullets?.length" class="mt-2 space-y-1 text-sm text-toned">
          <li v-for="bullet in day.bullets" :key="bullet" class="flex gap-2">
            <UIcon name="i-lucide-dot" class="mt-0.5 size-4 shrink-0 text-dimmed" />
            <span>{{ bullet }}</span>
          </li>
        </ul>
      </li>
    </ol>
  </section>
</template>
