<script setup lang="ts">
const props = defineProps<{
  instructor: {
    id: string
    name: string | null
    role: string | null
    vita: string | null
  }
}>()

/**
 * Initiale aus dem Nachnamen, nicht aus dem Dienstgrad:
 * "Oberbrandmeisterin Vogt" ergibt V, nicht O (QA-Befund).
 */
const initial = computed(() => {
  const parts = (props.instructor.name ?? '').trim().split(/\s+/).filter(Boolean)
  return (parts.at(-1) ?? '?').slice(0, 1).toUpperCase()
})
</script>

<template>
  <section
    class="rounded-lg border border-default bg-default p-5"
    data-testid="course-instructor"
  >
    <h2 class="text-lg font-semibold text-highlighted">
      Ausbilder
    </h2>

    <div class="mt-3 flex items-start gap-4">
      <span
        class="flex size-12 shrink-0 items-center justify-center rounded-full bg-navy-950 text-sm font-semibold text-white"
        aria-hidden="true"
      >
        {{ initial }}
      </span>
      <div>
        <p class="font-medium text-highlighted">
          {{ instructor.name }}
        </p>
        <p v-if="instructor.role" class="text-sm text-muted">
          {{ instructor.role }}
        </p>
        <p v-if="instructor.vita" class="mt-2 text-sm text-toned">
          {{ instructor.vita }}
        </p>
      </div>
    </div>
  </section>
</template>
