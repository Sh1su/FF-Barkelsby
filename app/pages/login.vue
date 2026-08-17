<script setup lang="ts">
import { loginSchema, type LoginInput } from '#shared/validation/auth'

definePageMeta({ layout: 'blank' })

const { organisation } = useRuntimeConfig().public
const route = useRoute()
const { fetch: refreshSession } = useUserSession()

const state = reactive<LoginInput>({ email: '', password: '' })
const busy = ref(false)
const errorMessage = ref('')

useHead({ title: 'Anmeldung' })

async function onSubmit() {
  busy.value = true
  errorMessage.value = ''
  try {
    const result = await $fetch('/api/auth/login', { method: 'POST', body: state })
    await refreshSession()
    const weiter = typeof route.query.weiter === 'string' ? route.query.weiter : undefined
    if (result.mustChangePassword) {
      await navigateTo('/passwort-aendern')
    }
    else {
      await navigateTo(weiter ?? (result.role === 'admin' ? '/verwaltung' : '/'))
    }
  }
  catch (error) {
    const status = (error as { statusCode?: number }).statusCode
    errorMessage.value = status === 429
      ? 'Zu viele Anmeldeversuche. Bitte in einigen Minuten erneut versuchen.'
      : 'E-Mail oder Passwort ist falsch.'
  }
  finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-navy-950 px-6 py-12 dark:bg-navy-950">
    <div class="w-full max-w-md">
      <div class="mb-3 flex justify-end">
        <ColorModeToggle />
      </div>
      <div class="rounded-lg bg-default p-8 shadow-xl">
        <div
          class="mb-6 flex size-11 items-center justify-center rounded-[10px] bg-fire-600 text-base font-semibold text-white"
          aria-hidden="true"
        >
          {{ organisation.shortName }}
        </div>

        <h1 class="text-2xl font-semibold text-highlighted">
          Anmeldung
        </h1>
        <p class="mt-2 text-sm text-toned">
          {{ organisation.name }} – Zugang für Angehörige der Wehr und die Wehrführung.
        </p>

        <UForm
          :schema="loginSchema"
          :state="state"
          class="mt-6 space-y-4"
          data-testid="login-form"
          @submit="onSubmit"
        >
          <UFormField label="E-Mail" name="email" required>
            <UInput
              v-model="state.email"
              type="email"
              autocomplete="username"
              placeholder="name@example.org"
              class="w-full"
              data-testid="login-email"
            />
          </UFormField>

          <UFormField label="Passwort" name="password" required>
            <UInput
              v-model="state.password"
              type="password"
              autocomplete="current-password"
              placeholder="••••••••"
              class="w-full"
              data-testid="login-password"
            />
          </UFormField>

          <UAlert
            v-if="errorMessage"
            color="error"
            variant="subtle"
            :title="errorMessage"
            data-testid="login-error"
          />

          <UButton
            type="submit"
            block
            size="lg"
            :loading="busy"
            :disabled="busy"
            data-testid="login-submit"
          >
            Anmelden
          </UButton>
        </UForm>
      </div>
    </div>
  </div>
</template>
