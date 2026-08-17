<script setup lang="ts">
import { changePasswordSchema, type ChangePasswordInput } from '#shared/validation/auth'
import { PASSWORD_MIN_LENGTH } from '#shared/constants'

definePageMeta({ layout: 'blank' })

const { user, fetch: refreshSession } = useUserSession()
const toast = useToast()

const state = reactive<ChangePasswordInput>({ currentPassword: '', newPassword: '' })
const busy = ref(false)
const errorMessage = ref('')

useHead({ title: 'Passwort ändern' })

async function onSubmit() {
  busy.value = true
  errorMessage.value = ''
  try {
    await $fetch('/api/auth/password', { method: 'POST', body: state })
    await refreshSession()
    toast.add({ title: 'Passwort geändert', color: 'success' })
    await navigateTo(user.value?.role === 'admin' ? '/verwaltung' : '/')
  }
  catch (error) {
    errorMessage.value = (error as { statusMessage?: string }).statusMessage
      ?? 'Das Passwort konnte nicht geändert werden.'
  }
  finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-navy-950 px-6 py-12 dark:bg-navy-950">
    <div class="w-full max-w-md rounded-lg bg-default p-8 shadow-xl">
      <h1 class="text-2xl font-semibold text-highlighted">
        Passwort ändern
      </h1>
      <p
        v-if="user?.mustChangePassword"
        class="mt-2 text-sm text-toned"
      >
        Dieses Konto verwendet noch das Startpasswort. Bitte vergeben Sie ein eigenes Passwort,
        bevor Sie weiterarbeiten.
      </p>

      <UForm
        :schema="changePasswordSchema"
        :state="state"
        class="mt-6 space-y-4"
        data-testid="password-form"
        @submit="onSubmit"
      >
        <UFormField label="Aktuelles Passwort" name="currentPassword" required>
          <UInput
            v-model="state.currentPassword"
            type="password"
            autocomplete="current-password"
            class="w-full"
            data-testid="password-current"
          />
        </UFormField>

        <UFormField
          label="Neues Passwort"
          name="newPassword"
          required
          :description="`Mindestens ${PASSWORD_MIN_LENGTH} Zeichen.`"
        >
          <UInput
            v-model="state.newPassword"
            type="password"
            autocomplete="new-password"
            class="w-full"
            data-testid="password-new"
          />
        </UFormField>

        <UAlert
          v-if="errorMessage"
          color="error"
          variant="subtle"
          :title="errorMessage"
          data-testid="password-error"
        />

        <UButton
          type="submit"
          block
          size="lg"
          :loading="busy"
          :disabled="busy"
          data-testid="password-submit"
        >
          Passwort speichern
        </UButton>
      </UForm>
    </div>
  </div>
</template>
