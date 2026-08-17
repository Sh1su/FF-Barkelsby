<script setup lang="ts">
defineEmits<{ reset: [] }>()
</script>

<template>
  <div
    class="rounded-lg border border-dashed border-accented bg-default p-10 text-center"
    data-testid="course-empty-state"
  >
    <UIcon name="i-lucide-search-x" class="size-8 text-dimmed" />
    <p class="mt-3 text-base font-medium text-highlighted">
      Kein Lehrgang gefunden
    </p>
    <p class="mt-1 text-sm text-toned">
      Filter zurücksetzen oder anderen Suchbegriff probieren.
    </p>
    <UButton
      class="mt-4"
      variant="outline"
      color="neutral"
      data-testid="course-reset-filters"
      @click="$emit('reset')"
    >
      Filter zurücksetzen
    </UButton>
  </div>
</template>
