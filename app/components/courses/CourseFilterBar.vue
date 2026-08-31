<script setup lang="ts">
const search = defineModel<string>('search', { required: true })
</script>

<template>
  <!-- min-h-11 = 44px: Mindestgroesse fuer Bedienelemente auf dem Handy (.claude/rules/testing.md) -->
  <UInput
    v-model="search"
    icon="i-lucide-search"
    size="lg"
    placeholder="Lehrgang oder Thema suchen"
    class="w-full"
    :ui="{ base: 'min-h-11' }"
    data-testid="course-search"
  />
</template>
