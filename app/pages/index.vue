<script setup lang="ts">
const { organisation } = useRuntimeConfig().public
const route = useRoute()
const router = useRouter()

useHead({ title: 'Aktuelle Lehrgänge' })

// Filterzustand steht in der URL (FV-2, AC-2) und übersteht damit ein Neuladen.
const search = ref(typeof route.query.q === 'string' ? route.query.q : '')

const debouncedSearch = useDebounced(search, 250)

watch(debouncedSearch, (q) => {
  router.replace({
    query: {
      ...(q ? { q } : {}),
    },
  })
})

const { data, status } = await useFetch('/api/courses', {
  query: computed(() => ({
    q: debouncedSearch.value || undefined,
  })),
})

const courses = computed(() => data.value?.items ?? [])

function resetFilters() {
  search.value = ''
}
</script>

<template>
  <div class="space-y-6">
    <header>
      <h1 class="text-2xl font-semibold text-highlighted">
        Aktuelle Lehrgänge
      </h1>
      <p class="mt-1 text-sm text-toned">
        {{ organisation.name }} · Anmeldung ohne persönliches Konto
      </p>
    </header>

    <CoursesCourseFilterBar v-model:search="search" />

    <p class="text-sm text-muted" data-testid="course-result-label">
      {{ data?.total ?? 0 }} {{ (data?.total ?? 0) === 1 ? 'Lehrgang' : 'Lehrgänge' }}
    </p>

    <div v-if="status === 'pending'" class="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
      <USkeleton v-for="index in 3" :key="index" class="h-80 w-full" />
    </div>

    <CoursesCourseEmptyState v-else-if="courses.length === 0" @reset="resetFilters" />

    <div v-else class="grid gap-5 md:grid-cols-2 xl:grid-cols-3" data-testid="course-list">
      <CoursesCourseCard
        v-for="course in courses"
        :key="course.id"
        :course="course"
      />
    </div>
  </div>
</template>
