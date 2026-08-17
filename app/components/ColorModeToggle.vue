<script setup lang="ts">
/**
 * Umschalter zwischen hellem und dunklem Modus.
 *
 * Voreinstellung ist die Systemwahl; ein Klick setzt sie bewusst auf hell oder dunkel und
 * merkt sich das im Browser. Bis das JavaScript geladen ist, wird nichts gerendert –
 * sonst zeigte der Server ein Symbol, das nach der Übernahme umspringt.
 */
const colorMode = useColorMode()
const geladen = ref(false)

onMounted(() => {
  geladen.value = true
})

const istDunkel = computed(() => colorMode.value === 'dark')

function umschalten() {
  colorMode.preference = istDunkel.value ? 'light' : 'dark'
}
</script>

<template>
  <ClientOnly>
    <UButton
      v-if="geladen"
      variant="ghost"
      color="neutral"
      :icon="istDunkel ? 'i-lucide-sun' : 'i-lucide-moon'"
      :aria-label="istDunkel ? 'Zur hellen Ansicht wechseln' : 'Zur dunklen Ansicht wechseln'"
      data-testid="color-mode-toggle"
      @click="umschalten"
    />
    <template #fallback>
      <span class="size-8" aria-hidden="true" />
    </template>
  </ClientOnly>
</template>
