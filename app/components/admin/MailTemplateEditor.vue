<script setup lang="ts">
import { TEMPLATE_FIELDS, TEMPLATE_LABELS } from '#shared/mail-templates'
import type { MailTemplate } from '#shared/mail-templates'
import { mailTemplateContentSchema } from '#shared/validation/settings'

/** E-Mail-Vorlagen bearbeiten – dritter Abschnitt der Einstellungen. */
const toast = useToast()

const { data: templates, refresh } = await useFetch('/api/admin/settings/mail-templates')

const items = (Object.keys(TEMPLATE_LABELS) as MailTemplate[]).map(key => ({
  value: key,
  label: TEMPLATE_LABELS[key],
}))

/** Baut "{{feld}}" fuers Template – als Funktion, damit Vue die Klammern nicht als Mustache liest. */
function placeholder(field: string): string {
  return `{{${field}}}`
}
const selected = ref<MailTemplate>('lehrgang-abgesagt')

const current = computed(() => templates.value?.find(entry => entry.key === selected.value))

const draft = reactive({ subject: '', body: '' })
const busy = ref(false)
const error = ref('')

watch(current, (value) => {
  if (!value) return
  draft.subject = value.subject
  draft.body = value.body
}, { immediate: true })

const fields = computed(() => TEMPLATE_FIELDS[selected.value])

async function save() {
  busy.value = true
  error.value = ''
  try {
    await $fetch(`/api/admin/settings/mail-templates/${selected.value}`, {
      method: 'PATCH',
      body: draft,
    })
    toast.add({ title: 'Vorlage gespeichert', color: 'success' })
    await refresh()
  }
  catch (fehler) {
    error.value = (fehler as { statusMessage?: string }).statusMessage ?? 'Konnte nicht gespeichert werden.'
  }
  finally {
    busy.value = false
  }
}

async function reset() {
  busy.value = true
  error.value = ''
  try {
    await $fetch(`/api/admin/settings/mail-templates/${selected.value}/reset`, { method: 'POST' })
    toast.add({ title: 'Auf Standardtext zurückgesetzt', color: 'success' })
    await refresh()
  }
  catch (fehler) {
    error.value = (fehler as { statusMessage?: string }).statusMessage ?? 'Konnte nicht zurückgesetzt werden.'
  }
  finally {
    busy.value = false
  }
}

const preview = ref<{ subject: string, text: string } | null>(null)
const previewBusy = ref(false)
const previewError = ref('')

async function showPreview() {
  previewBusy.value = true
  previewError.value = ''
  preview.value = null
  try {
    preview.value = await $fetch(`/api/admin/settings/mail-templates/${selected.value}/preview`, {
      method: 'POST',
      body: draft,
    })
  }
  catch (fehler) {
    previewError.value = (fehler as { statusMessage?: string }).statusMessage ?? 'Vorschau nicht möglich.'
  }
  finally {
    previewBusy.value = false
  }
}

watch(selected, () => { preview.value = null; previewError.value = '' })
</script>

<template>
  <section class="space-y-4 rounded-lg border border-default bg-default p-5" data-testid="settings-mail-templates">
    <h2 class="text-sm font-semibold uppercase tracking-wide text-muted">
      E-Mail-Vorlagen
    </h2>
    <p class="text-sm text-muted">
      Betreff und Text der automatisch versendeten E-Mails. <code>{{ placeholder('feld') }}</code> wird durch
      den jeweiligen Wert ersetzt.
    </p>

    <USelect v-model="selected" :items="items" class="w-full sm:w-80" data-testid="settings-mail-template-select" />

    <div v-if="current" class="space-y-4">
      <UBadge v-if="current.isCustom" color="primary" variant="subtle" size="sm">
        Angepasst
      </UBadge>
      <UBadge v-else color="neutral" variant="subtle" size="sm">
        Standardtext
      </UBadge>

      <UForm :schema="mailTemplateContentSchema" :state="draft" class="space-y-4" @submit="save">
        <UFormField label="Betreff" name="subject">
          <UInput v-model="draft.subject" class="w-full" data-testid="settings-mail-template-subject" />
        </UFormField>

        <UFormField label="Text" name="body">
          <UTextarea v-model="draft.body" :rows="10" class="w-full font-mono text-sm" data-testid="settings-mail-template-body" />
        </UFormField>

        <p class="text-xs text-muted">
          Verfügbare Platzhalter: <code v-for="field in fields" :key="field" class="mr-1">{{ placeholder(field) }}</code>
        </p>

        <UAlert v-if="error" color="error" variant="subtle" :title="error" />

        <div class="flex flex-wrap gap-2">
          <UButton type="submit" :loading="busy" data-testid="settings-mail-template-save">
            Speichern
          </UButton>
          <UButton variant="outline" color="neutral" :loading="previewBusy" data-testid="settings-mail-template-preview" @click="showPreview">
            Vorschau
          </UButton>
          <UButton
            v-if="current.isCustom"
            variant="outline"
            color="neutral"
            :loading="busy"
            data-testid="settings-mail-template-reset"
            @click="reset"
          >
            Auf Standard zurücksetzen
          </UButton>
        </div>
      </UForm>

      <UAlert v-if="previewError" color="error" variant="subtle" :title="previewError" />
      <div
        v-if="preview"
        class="rounded-lg border border-default bg-elevated p-4 text-sm"
        data-testid="settings-mail-template-preview-result"
      >
        <p class="font-semibold text-highlighted">
          {{ preview.subject }}
        </p>
        <p class="mt-2 whitespace-pre-wrap text-toned">
          {{ preview.text }}
        </p>
      </div>
    </div>
  </section>
</template>
