<script setup lang="ts">
const { organisation } = useRuntimeConfig().public
const { logout } = useAuth()
</script>

<template>
  <div class="min-h-screen">
    <header class="sticky top-0 z-20 border-b border-default bg-navy-950 text-white">
      <div class="mx-auto flex max-w-[1180px] items-center gap-4 px-6 py-3.5">
        <NuxtLink to="/verwaltung" class="flex items-center gap-3 text-white no-underline">
          <span
            class="flex size-9.5 items-center justify-center rounded-[10px] bg-fire-600 text-sm font-semibold"
            aria-hidden="true"
          >{{ organisation.shortName }}</span>
          <span class="text-base font-semibold">Verwaltung</span>
        </NuxtLink>

        <div class="ml-auto flex items-center gap-2">
          <ColorModeToggle />
          <UButton
            to="/"
            variant="ghost"
            color="neutral"
            class="text-white hover:bg-default/10"
            icon="i-lucide-external-link"
          >
            Zur Übersicht
          </UButton>
          <UButton
            variant="ghost"
            color="neutral"
            class="text-white hover:bg-default/10"
            icon="i-lucide-log-out"
            data-testid="logout-button"
            @click="logout()"
          >
            Abmelden
          </UButton>
        </div>
      </div>
    </header>

    <main class="mx-auto max-w-[1180px] px-6 py-8">
      <slot />
    </main>
  </div>
</template>
