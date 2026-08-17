<script setup lang="ts">
const { organisation } = useRuntimeConfig().public
const { user } = useUserSession()
const { logout } = useAuth()
</script>

<template>
  <div class="min-h-screen">
    <header class="sticky top-0 z-20 border-b border-default bg-default">
      <div class="mx-auto flex max-w-[1180px] items-center gap-4 px-6 py-3.5">
        <NuxtLink to="/" class="flex items-center gap-3 no-underline">
          <span
            class="flex size-9.5 items-center justify-center rounded-[10px] bg-fire-600 text-sm font-semibold text-white"
            aria-hidden="true"
          >{{ organisation.shortName }}</span>
          <span class="text-base font-semibold text-highlighted">Aktuelle Lehrgänge</span>
        </NuxtLink>

        <div class="ml-auto flex items-center gap-2">
          <ColorModeToggle />
          <UButton
            v-if="user?.role === 'admin'"
            to="/verwaltung"
            variant="ghost"
            color="neutral"
            icon="i-lucide-settings"
            data-testid="admin-link"
          >
            Verwaltung
          </UButton>
          <UButton
            variant="ghost"
            color="neutral"
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

    <footer class="mx-auto max-w-[1180px] px-6 pb-10 text-xs text-muted">
      {{ organisation.name }}
    </footer>
  </div>
</template>
