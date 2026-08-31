<script setup lang="ts">
const route = useRoute()
const id = computed(() => String(route.params.id))

const { data: course, error, refresh } = await useFetch(() => `/api/courses/${id.value}`)

const { dateRange, durationLabel } = useCourseFormat()

useHead({ title: () => course.value?.title ?? 'Lehrgang' })

const signupModalOpen = ref(false)

const courseMeta = computed(() => {
  if (!course.value) return ''
  return dateRange(course.value.startsOn, course.value.endsOn)
})

const facts = computed(() => {
  if (!course.value) return []
  return [
    { icon: 'i-lucide-calendar-days', label: 'Zeitraum', value: dateRange(course.value.startsOn, course.value.endsOn) },
    { icon: 'i-lucide-hourglass', label: 'Dauer', value: durationLabel(course.value.startsOn, course.value.endsOn) },
    ...(course.value.confirmedCount > 0
      ? [{ icon: 'i-lucide-users', label: 'Anmeldungen', value: `${course.value.confirmedCount} bestätigt` }]
      : []),
  ]
})

const anmeldungGeschlossen = computed(() => !!course.value && !course.value.signupOpen)
</script>

<template>
  <div>
    <UAlert
      v-if="error"
      color="error"
      variant="subtle"
      title="Dieser Lehrgang existiert nicht (mehr)."
      data-testid="course-not-found"
    />

    <div v-else-if="course" class="space-y-6">
      <UButton
        to="/"
        variant="ghost"
        color="neutral"
        icon="i-lucide-arrow-left"
        data-testid="course-back-link"
      >
        Übersicht
      </UButton>

      <img
        :src="`/api/courses/${course.id}/cover.svg?variant=hero`"
        :alt="`Titelbild ${course.title}`"
        class="aspect-[1180/340] w-full rounded-lg object-cover"
      >

      <div class="flex flex-wrap items-center gap-2">
        <UBadge
          v-if="course.status === 'abgesagt'"
          color="error"
          variant="subtle"
          data-testid="course-cancelled-badge"
        >
          Abgesagt
        </UBadge>
        <UBadge
          v-else-if="anmeldungGeschlossen"
          color="neutral"
          variant="subtle"
          data-testid="course-closed-badge"
        >
          Anmeldung geschlossen
        </UBadge>
      </div>

      <h1 class="text-3xl font-semibold text-highlighted" data-testid="course-title">
        {{ course.title }}
      </h1>

      <div class="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div class="space-y-6">
          <section v-if="course.description || course.topics?.length" data-testid="course-description">
            <h2 class="text-lg font-semibold text-highlighted">
              Über den Lehrgang
            </h2>
            <p v-if="course.description" class="mt-2 text-default">
              {{ course.description }}
            </p>
            <ul v-if="course.topics?.length" class="mt-4 grid gap-2 sm:grid-cols-2">
              <li
                v-for="topic in course.topics"
                :key="topic"
                class="flex items-start gap-2 rounded-lg border border-default bg-default p-3 text-sm text-default"
              >
                <UIcon name="i-lucide-check" class="mt-0.5 size-4 shrink-0 text-fire-600" />
                <span>{{ topic }}</span>
              </li>
            </ul>
          </section>

          <CoursesCourseProgram v-if="course.days.length" :days="course.days" />
        </div>

        <aside class="space-y-4">
          <div class="rounded-lg border border-default bg-default p-5" data-testid="course-facts">
            <dl class="space-y-3">
              <div v-for="fact in facts" :key="fact.label" class="flex items-start gap-3">
                <UIcon :name="fact.icon" class="mt-0.5 size-4 shrink-0 text-dimmed" />
                <div>
                  <dt class="text-xs uppercase tracking-wide text-muted">
                    {{ fact.label }}
                  </dt>
                  <dd class="text-sm font-medium text-highlighted">
                    {{ fact.value }}
                  </dd>
                </div>
              </div>
            </dl>

            <UButton
              class="mt-5"
              block
              size="lg"
              :disabled="course.status === 'abgesagt' || anmeldungGeschlossen"
              data-testid="course-signup-button"
              @click="signupModalOpen = true"
            >
              Interesse bekunden
            </UButton>
            <p class="mt-2 text-center text-xs text-muted">
              {{ course.status === 'abgesagt'
                ? 'Dieser Lehrgang wurde abgesagt.'
                : anmeldungGeschlossen
                  ? 'Dieser Lehrgang hat bereits begonnen und nimmt keine Anmeldungen mehr an.'
                  : 'Kein persönliches Konto nötig · 3 Felder' }}
            </p>
          </div>
        </aside>
      </div>

      <SignupsSignupModal
        v-model:open="signupModalOpen"
        :course-id="course.id"
        :course-title="course.title"
        :course-meta="courseMeta"
        @created="refresh()"
      />
    </div>
  </div>
</template>
