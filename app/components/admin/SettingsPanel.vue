<script setup lang="ts">
import { brandingSettingsSchema, mailSettingsSchema } from '#shared/validation/settings'

/** Vierter Tab der Verwaltung: Erscheinungsbild und SMTP-Relay pflegen. */
const toast = useToast()
const { user } = useUserSession()
const { data: branding, refresh: refreshBranding } = await useBranding()

const brandingState = reactive({ name: '', shortName: '' })
const brandingBusy = ref(false)
const brandingError = ref('')

watchEffect(() => {
  if (!branding.value) return
  brandingState.name = branding.value.name
  brandingState.shortName = branding.value.shortName
})

async function saveBranding() {
  brandingBusy.value = true
  brandingError.value = ''
  try {
    await $fetch('/api/admin/settings/branding', { method: 'PATCH', body: brandingState })
    toast.add({ title: 'Erscheinungsbild gespeichert', color: 'success' })
    await refreshBranding()
  }
  catch (error) {
    brandingError.value = (error as { statusMessage?: string }).statusMessage
      ?? 'Konnte nicht gespeichert werden.'
  }
  finally {
    brandingBusy.value = false
  }
}

const logoInput = ref<HTMLInputElement>()
const logoBusy = ref(false)
const logoError = ref('')

function pickLogo() {
  logoInput.value?.click()
}

async function onLogoSelected(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return

  logoBusy.value = true
  logoError.value = ''
  try {
    const form = new FormData()
    form.append('logo', file)
    await $fetch('/api/admin/settings/branding/logo', { method: 'POST', body: form })
    toast.add({ title: 'Logo aktualisiert', color: 'success' })
    await refreshBranding()
  }
  catch (error) {
    logoError.value = (error as { statusMessage?: string }).statusMessage
      ?? 'Das Logo konnte nicht hochgeladen werden.'
  }
  finally {
    logoBusy.value = false
    if (logoInput.value) logoInput.value.value = ''
  }
}

const { data: mail, refresh: refreshMail } = await useFetch('/api/admin/settings/mail')

const mailState = reactive({ host: '', port: 587, user: '', password: '', from: '' })
const mailBusy = ref(false)
const mailError = ref('')
const passwordSichtbar = ref(false)

watchEffect(() => {
  if (!mail.value) return
  mailState.host = mail.value.host
  mailState.port = mail.value.port
  mailState.user = mail.value.user
  mailState.from = mail.value.from
  mailState.password = ''
})

async function saveMail() {
  mailBusy.value = true
  mailError.value = ''
  try {
    await $fetch('/api/admin/settings/mail', {
      method: 'PATCH',
      body: { ...mailState, password: mailState.password || undefined },
    })
    toast.add({ title: 'SMTP-Relay gespeichert', color: 'success' })
    await refreshMail()
  }
  catch (error) {
    mailError.value = (error as { statusMessage?: string }).statusMessage
      ?? 'Konnte nicht gespeichert werden.'
  }
  finally {
    mailBusy.value = false
  }
}

const testRecipient = ref(user.value?.email ?? '')
const testBusy = ref(false)
const testResult = ref<{ ok: boolean, message: string } | null>(null)

async function sendTestMail() {
  testBusy.value = true
  testResult.value = null
  try {
    await $fetch('/api/admin/settings/mail/test', { method: 'POST', body: { to: testRecipient.value } })
    testResult.value = { ok: true, message: `Testmail an ${testRecipient.value} verschickt.` }
  }
  catch (error) {
    testResult.value = {
      ok: false,
      message: (error as { statusMessage?: string }).statusMessage ?? 'Testmail konnte nicht verschickt werden.',
    }
  }
  finally {
    testBusy.value = false
  }
}
</script>

<template>
  <div class="space-y-6" data-testid="settings-panel">
    <section class="space-y-4 rounded-lg border border-default bg-default p-5" data-testid="settings-branding">
      <h2 class="text-sm font-semibold uppercase tracking-wide text-muted">
        Erscheinungsbild
      </h2>

      <div class="flex items-center gap-4">
        <img
          :src="branding?.logoUrl"
          alt="Aktuelles Logo"
          class="size-16 rounded-[10px] border border-default object-contain"
        >
        <div>
          <UButton
            variant="outline"
            color="neutral"
            :loading="logoBusy"
            data-testid="settings-logo-upload"
            @click="pickLogo"
          >
            Logo ändern
          </UButton>
          <p class="mt-1 text-xs text-muted">
            PNG, JPEG, WebP oder SVG · max. 2 MB
          </p>
        </div>
        <input
          ref="logoInput"
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
          class="hidden"
          @change="onLogoSelected"
        >
      </div>
      <UAlert v-if="logoError" color="error" variant="subtle" :title="logoError" />

      <UForm :schema="brandingSettingsSchema" :state="brandingState" class="space-y-4" @submit="saveBranding">
        <UFormField label="Name der Wehr" name="name" required>
          <UInput v-model="brandingState.name" class="w-full" data-testid="settings-org-name" />
        </UFormField>
        <UFormField label="Kurzname" name="shortName" description="Erscheint im Badge oben links." required>
          <UInput v-model="brandingState.shortName" class="w-full" data-testid="settings-org-shortname" />
        </UFormField>
        <UAlert v-if="brandingError" color="error" variant="subtle" :title="brandingError" />
        <UButton type="submit" :loading="brandingBusy" data-testid="settings-branding-save">
          Speichern
        </UButton>
      </UForm>
    </section>

    <section class="space-y-4 rounded-lg border border-default bg-default p-5" data-testid="settings-mail">
      <h2 class="text-sm font-semibold uppercase tracking-wide text-muted">
        SMTP-Relay
      </h2>
      <p class="text-sm text-muted">
        Ohne Host bleibt der Mailversand deaktiviert – ausgeloeste E-Mails werden dann nur
        protokolliert, nicht verschickt.
      </p>

      <UForm :schema="mailSettingsSchema" :state="mailState" class="space-y-4" @submit="saveMail">
        <div class="grid gap-4 sm:grid-cols-[1fr_120px]">
          <UFormField label="Host" name="host">
            <UInput v-model="mailState.host" placeholder="smtp.example.org" class="w-full" data-testid="settings-mail-host" />
          </UFormField>
          <UFormField label="Port" name="port">
            <UInput v-model.number="mailState.port" type="number" class="w-full" data-testid="settings-mail-port" />
          </UFormField>
        </div>
        <UFormField label="Absenderadresse" name="from">
          <UInput v-model="mailState.from" type="email" placeholder="wehr@example.org" class="w-full" data-testid="settings-mail-from" />
        </UFormField>
        <UFormField label="Benutzername" name="user">
          <UInput v-model="mailState.user" class="w-full" data-testid="settings-mail-user" />
        </UFormField>
        <UFormField
          label="Passwort"
          name="password"
          :description="mail?.hasPassword ? 'Leer lassen, um das gespeicherte Passwort zu behalten.' : undefined"
        >
          <UInput
            v-model="mailState.password"
            :type="passwordSichtbar ? 'text' : 'password'"
            class="w-full"
            data-testid="settings-mail-password"
          >
            <template #trailing>
              <UButton
                variant="link"
                color="neutral"
                :icon="passwordSichtbar ? 'i-lucide-eye-off' : 'i-lucide-eye'"
                :aria-label="passwordSichtbar ? 'Passwort verbergen' : 'Passwort anzeigen'"
                @click="passwordSichtbar = !passwordSichtbar"
              />
            </template>
          </UInput>
        </UFormField>

        <UAlert v-if="mailError" color="error" variant="subtle" :title="mailError" />
        <UButton type="submit" :loading="mailBusy" data-testid="settings-mail-save">
          Speichern
        </UButton>
      </UForm>

      <div class="flex flex-wrap items-end gap-2 border-t border-default pt-4">
        <UFormField label="Testmail an" class="flex-1">
          <UInput v-model="testRecipient" type="email" class="w-full" data-testid="settings-mail-test-recipient" />
        </UFormField>
        <UButton
          variant="outline"
          color="neutral"
          :loading="testBusy"
          data-testid="settings-mail-test-send"
          @click="sendTestMail"
        >
          Testmail senden
        </UButton>
      </div>
      <UAlert
        v-if="testResult"
        :color="testResult.ok ? 'success' : 'error'"
        variant="subtle"
        :title="testResult.message"
        data-testid="settings-mail-test-result"
      />
    </section>

    <AdminMailTemplateEditor />
  </div>
</template>
