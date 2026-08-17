<script setup lang="ts">
import { CATEGORIES, CATEGORY_LABELS, type Category } from '#shared/constants'

const search = defineModel<string>('search', { required: true })
const category = defineModel<Category | undefined>('category', { required: true })

const filters = computed(() => [
  { value: undefined, label: 'Alle' },
  ...CATEGORIES.map(value => ({ value, label: CATEGORY_LABELS[value] })),
])
</script>

<template>
  <div class="space-y-4">
    <!-- min-h-11 = 44px: Mindestgroesse fuer Bedienelemente auf dem Handy (.claude/rules/testing.md) -->
    <UInput
      v-model="search"
      icon="i-lucide-search"
      size="lg"
      placeholder="Lehrgang, Thema oder Ausbilder suchen"
      class="w-full"
      :ui="{ base: 'min-h-11' }"
      data-testid="course-search"
    />

    <div class="flex flex-wrap gap-2" role="group" aria-label="Nach Kategorie filtern">
      <UButton
        v-for="filter in filters"
        :key="filter.value ?? 'alle'"
        size="md"
        class="min-h-11 rounded-full"
        :color="category === filter.value ? 'primary' : 'neutral'"
        :variant="category === filter.value ? 'solid' : 'outline'"
        :aria-pressed="category === filter.value"
        :data-testid="`course-filter-${filter.value ?? 'alle'}`"
        @click="category = filter.value"
      >
        {{ filter.label }}
      </UButton>
    </div>
  </div>
</template>
