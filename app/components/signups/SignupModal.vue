<script setup lang="ts">
import { createSignupSchema } from '#shared/validation/signup'

const open = defineModel<boolean>('open', { required: true })
const props = defineProps<{
  courseId: string
  courseTitle: string
  courseMeta: string
}>()
const emit = defineEmits<{ created: [] }>()

// `consent` ist im Schema `literal(true)`; im Formular muss es zwischendurch `false` sein
// duerfen – deshalb hier ein eigener Zustandstyp.
const state = reactive<{ firstName: string, lastName: string, email: string, consent: boolean }>({
  firstName: '',
  lastName: '',
  email: '',
  consent: false,
})
const busy = ref(false)
const errorMessage = ref('')
const done = ref(false)

watch(open, (offen) => {
  if (!offen) return
  // Bei jedem Öffnen frisch beginnen.
  Object.assign(state, { firstName: '', lastName: '', email: '', consent: false })
  errorMessage.value = ''
  done.value = false
})

async function onSubmit() {
  busy.value = true
  errorMessage.value = ''
  try {
    await $fetch(`/api/courses/${props.courseId}/signups`, { method: 'POST', body: state })
    done.value = true
    emit('created')
  }
  catch (error) {
    errorMessage.value = (error as { statusMessage?: string }).statusMessage
      ?? 'Die Anmeldung konnte nicht gespeichert werden.'
  }
  finally {
    busy.value = false
  }
}
</script>

<template>
  <UModal v-model:open="open" title="Interesse bekunden">
    <template #body>
      <div v-if="done" class="space-y-4 text-center" data-testid="signup-done">
        <UIcon name="i-lucide-check-circle-2" class="size-10 text-primary" />
        <p class="text-lg font-semibold text-highlighted">
          Interesse bekundet
        </p>
        <p class="text-sm text-toned">
          Ihre Anmeldung für <strong>{{ courseTitle }}</strong> ist eingegangen. Sie erhalten eine
          Bestätigung per E-Mail, sobald die Wehrführung Ihren Platz freigibt.
        </p>
        <UButton block size="lg" data-testid="signup-close" @click="open = false">
          Fertig
        </UButton>
      </div>

      <UForm
        v-else
        :schema="createSignupSchema"
        :state="(state as never)"
        class="space-y-4"
        data-testid="signup-form"
        @submit="onSubmit"
      >
        <div>
          <p class="font-medium text-highlighted">
            {{ courseTitle }}
          </p>
          <p class="text-sm text-muted">
            {{ courseMeta }}
          </p>
        </div>

        <div class="grid gap-4 sm:grid-cols-2">
          <UFormField label="Vorname" name="firstName" required>
            <UInput
              v-model="state.firstName"
              autocomplete="given-name"
              class="w-full"
              data-testid="signup-firstname"
            />
          </UFormField>
          <UFormField label="Nachname" name="lastName" required>
            <UInput
              v-model="state.lastName"
              autocomplete="family-name"
              class="w-full"
              data-testid="signup-lastname"
            />
          </UFormField>
        </div>

        <UFormField label="E-Mail" name="email" required>
          <UInput
            v-model="state.email"
            type="email"
            autocomplete="email"
            placeholder="name@example.org"
            class="w-full"
            data-testid="signup-email"
          />
        </UFormField>

        <UFormField name="consent">
          <UCheckbox v-model="state.consent" data-testid="signup-consent">
            <template #label>
              <span class="text-sm text-toned">
                Ich bin mit der Speicherung meiner Angaben zur Bearbeitung dieser Anmeldung
                einverstanden (<NuxtLink to="/datenschutz" target="_blank" class="underline">Datenschutz</NuxtLink>).
              </span>
            </template>
          </UCheckbox>
        </UFormField>

        <UAlert
          v-if="errorMessage"
          color="error"
          variant="subtle"
          :title="errorMessage"
          data-testid="signup-error"
        />

        <UButton
          type="submit"
          block
          size="lg"
          :loading="busy"
          :disabled="busy"
          data-testid="signup-submit"
        >
          Interesse bekunden
        </UButton>

        <p class="text-center text-xs text-muted">
          Kein persönliches Konto nötig · 3 Felder · unter 15 Sekunden
        </p>
      </UForm>
    </template>
  </UModal>
</template>
