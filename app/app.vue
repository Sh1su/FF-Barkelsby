<script setup lang="ts">
const { data: branding } = await useBranding()

useHead({
  title: () => branding.value?.name ?? 'Fortbildungsverwaltung',
})
</script>

<template>
  <UApp :toaster="{ position: 'top-center' }">
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
