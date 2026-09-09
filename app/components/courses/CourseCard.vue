<script setup lang="ts">
interface CourseCardData {
  id: string
  title: string
  summary: string | null
  startsOn: string | number | Date
  endsOn: string | number | Date
  confirmedCount: number
  signupOpen: boolean
  status: 'geplant' | 'abgesagt'
}

const props = defineProps<{ course: CourseCardData }>()

const { dateRange, dayBadge } = useCourseFormat()
const badge = computed(() => dayBadge(props.course.startsOn))
const cancelled = computed(() => props.course.status === 'abgesagt')
const geschlossen = computed(() => !cancelled.value && !props.course.signupOpen)
</script>

<template>
  <article
    class="flex flex-col overflow-hidden rounded-lg border border-default bg-default"
    :class="cancelled && 'opacity-70'"
    data-testid="course-card"
  >
    <div class="relative">
      <img
        :src="`/api/courses/${course.id}/cover.svg`"
        :alt="`Titelbild ${course.title}`"
        class="aspect-[800/320] w-full object-cover"
        loading="lazy"
      >
      <div
        class="absolute right-4 top-4 rounded-lg bg-default/95 px-3 py-1.5 text-center leading-tight"
        data-testid="course-date-badge"
      >
        <div class="text-lg font-semibold text-highlighted">
          {{ badge.day }}
        </div>
        <div class="text-[11px] font-medium uppercase tracking-wide text-muted">
          {{ badge.month }}
        </div>
      </div>
    </div>

    <div class="flex flex-1 flex-col gap-3 p-5">
      <h2 class="text-lg font-semibold text-highlighted">
        <NuxtLink :to="`/lehrgang/${course.id}`" class="no-underline hover:underline">
          {{ course.title }}
        </NuxtLink>
      </h2>

      <p v-if="course.summary" class="text-sm text-toned">
        {{ course.summary }}
      </p>

      <dl class="mt-auto space-y-1.5 text-sm text-toned">
        <div class="flex items-center gap-2">
          <UIcon name="i-lucide-calendar-days" class="size-4 shrink-0 text-dimmed" />
          <dt class="sr-only">Zeitraum</dt>
          <dd>{{ dateRange(course.startsOn, course.endsOn) }}</dd>
        </div>
        <div v-if="course.confirmedCount > 0" class="flex items-center gap-2">
          <UIcon name="i-lucide-users" class="size-4 shrink-0 text-dimmed" />
          <dt class="sr-only">Anmeldungen</dt>
          <dd data-testid="course-signups">
            {{ course.confirmedCount }} {{ course.confirmedCount === 1 ? 'Anmeldung' : 'Anmeldungen' }} bestätigt
          </dd>
        </div>
      </dl>

      <div class="flex items-center gap-2 pt-2">
        <UBadge
          v-if="cancelled"
          color="error"
          variant="subtle"
          data-testid="course-cancelled-badge"
        >
          Abgesagt
        </UBadge>
        <UBadge
          v-else-if="geschlossen"
          color="neutral"
          variant="subtle"
          data-testid="course-closed-badge"
        >
          Anmeldung geschlossen
        </UBadge>

        <UButton
          :to="`/lehrgang/${course.id}`"
          variant="outline"
          color="neutral"
          class="ml-auto"
          data-testid="course-details-link"
        >
          Details
        </UButton>
      </div>
    </div>
  </article>
</template>
