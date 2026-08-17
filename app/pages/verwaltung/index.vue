<script setup lang="ts">
definePageMeta({ layout: 'admin' })
useHead({ title: 'Verwaltung' })

const tabs = [
  { value: 'kalender', label: 'Kalender', icon: 'i-lucide-calendar' },
  { value: 'registratur', label: 'Registratur', icon: 'i-lucide-clipboard-list' },
  { value: 'benutzer', label: 'Benutzerverwaltung', icon: 'i-lucide-users' },
]
const tab = ref('kalender')

const now = new Date()
const year = ref(now.getFullYear())
const month = ref(now.getMonth())

const range = computed(() => ({
  von: toIsoDate(new Date(year.value, month.value - 1, 1)),
  bis: toIsoDate(new Date(year.value, month.value + 2, 0)),
}))

const { data, refresh } = await useFetch('/api/admin/courses', { query: range })
const courses = computed(() => data.value?.items ?? [])

const createOpen = ref(false)
const selectedDate = ref<string>()

function onSelectDay(iso: string) {
  selectedDate.value = iso
  createOpen.value = true
}

function openBlankCreate() {
  selectedDate.value = toIsoDate(new Date())
  createOpen.value = true
}

// Ein Lehrgang zaehlt zum Monat, wenn er ihn irgendwo beruehrt – nicht nur am Monatsanfang.
const monthSummary = computed(() => {
  const first = toIsoDate(new Date(year.value, month.value, 1))
  const last = toIsoDate(new Date(year.value, month.value + 1, 0))

  const inMonth = courses.value.filter((course) => {
    const start = toIsoDate(new Date(course.startsOn))
    const end = toIsoDate(new Date(course.endsOn))
    return start <= last && end >= first
  })

  return inMonth.length === 1
    ? '1 Lehrgang in diesem Monat'
    : `${inMonth.length} Lehrgänge in diesem Monat`
})

const { dateRange } = useCourseFormat()
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-center gap-3">
      <UTabs
        v-model="tab"
        :items="tabs"
        :content="false"
        class="w-full sm:w-auto"
        data-testid="admin-tabs"
      />
      <UButton
        v-if="tab === 'kalender'"
        icon="i-lucide-plus"
        class="sm:ml-auto"
        data-testid="admin-new-course"
        @click="openBlankCreate"
      >
        Neue Fortbildung
      </UButton>
    </div>

    <template v-if="tab === 'kalender'">
      <AdminCourseCalendar
        v-model:year="year"
        v-model:month="month"
        :courses="courses"
        @select-day="onSelectDay"
      />
      <p class="text-sm text-muted" data-testid="calendar-summary">
        {{ monthSummary }}
      </p>

      <section v-if="courses.length" class="space-y-2">
        <h2 class="text-sm font-semibold uppercase tracking-wide text-muted">
          Lehrgänge im Zeitraum
        </h2>
        <ul class="divide-y divide-navy-200 rounded-lg border border-default bg-default">
          <li
            v-for="course in courses"
            :key="course.id"
            class="flex flex-wrap items-center gap-3 px-4 py-3"
            data-testid="admin-course-row"
          >
            <span class="font-medium text-highlighted" :class="course.status === 'abgesagt' && 'line-through'">
              {{ course.title }}
            </span>
            <UBadge v-if="course.status === 'abgesagt'" color="error" variant="subtle" size="sm">
              Abgesagt
            </UBadge>
            <span class="text-sm text-muted">
              {{ dateRange(course.startsOn, course.endsOn) }}
            </span>
            <UButton
              :to="`/verwaltung/lehrgang/${course.id}`"
              size="sm"
              variant="outline"
              color="neutral"
              class="ml-auto"
              data-testid="admin-course-edit"
            >
              Bearbeiten
            </UButton>
          </li>
        </ul>
      </section>
    </template>

    <AdminSignupRegistry v-else-if="tab === 'registratur'" />

    <AdminUserRegistry v-else />

    <AdminCourseQuickCreateModal
      v-model:open="createOpen"
      :date="selectedDate"
      @created="refresh()"
    />
  </div>
</template>
