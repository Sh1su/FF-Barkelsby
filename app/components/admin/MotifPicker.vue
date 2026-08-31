<script setup lang="ts">
const motif = defineModel<number | undefined>('motif', { required: true })
const palette = defineModel<number | undefined>('palette', { required: true })

const props = defineProps<{ title?: string }>()

const MOTIFS = [0, 1, 2, 3, 4, 5, 6, 7]
const PALETTES = [0, 1, 2, 3]

const activePalette = computed(() => palette.value ?? 0)

function previewUrl(index: number) {
  const params = new URLSearchParams({
    motif: String(index),
    palette: String(activePalette.value),
    title: props.title || 'Vorschau',
  })
  return `/api/admin/cover-preview.svg?${params.toString()}`
}
</script>

<template>
  <div class="space-y-3" data-testid="motif-picker">
    <div class="flex items-center gap-2">
      <span class="text-sm text-toned">Farbe</span>
      <UButton
        v-for="index in PALETTES"
        :key="index"
        size="xs"
        :color="activePalette === index ? 'primary' : 'neutral'"
        :variant="activePalette === index ? 'solid' : 'outline'"
        :aria-label="`Farbvariante ${index + 1}`"
        :aria-pressed="activePalette === index"
        @click="palette = index"
      >
        {{ index + 1 }}
      </UButton>
    </div>

    <div class="grid grid-cols-4 gap-2">
      <button
        v-for="index in MOTIFS"
        :key="index"
        type="button"
        class="overflow-hidden rounded-lg border-2 transition"
        :class="motif === index ? 'border-fire-600' : 'border-transparent hover:border-accented'"
        :aria-label="`Motiv ${index + 1}`"
        :aria-pressed="motif === index"
        :data-testid="`motif-option-${index}`"
        @click="motif = index"
      >
        <img :src="previewUrl(index)" :alt="`Motiv ${index + 1}`" class="aspect-[800/320] w-full">
      </button>
    </div>

    <p class="text-xs text-muted">
      Ohne Auswahl wird automatisch ein Motiv vergeben – das Titelbild bleibt nie leer.
    </p>
  </div>
</template>
