<script setup lang="ts">
const { organisation } = useRuntimeConfig().public

useHead({
  title: organisation.name,
})
</script>

<template>
  <UApp :toaster="{ position: 'top-center' }">
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
