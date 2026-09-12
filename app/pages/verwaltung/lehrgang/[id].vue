<script setup lang="ts">
definePageMeta({ layout: 'admin' })

const route = useRoute()
const router = useRouter()
const toast = useToast()
const id = computed(() => String(route.params.id))

const { data: course, refresh } = await useFetch(() => `/api/courses/${id.value}`)
const { data: mailData, refresh: refreshMails } = await useFetch(() => `/api/admin/courses/${id.value}/mails`)
const { data: allCoursesData } = await useFetch('/api/admin/courses')
const { data: prerequisitesData, refresh: refreshPrerequisites } = await useFetch(
  () => `/api/admin/courses/${id.value}/prerequisites`,
)

useHead({ title: () => `${course.value?.title ?? 'Lehrgang'} bearbeiten` })

const state = reactive({
  title: '',
  summary: '',
  description: '',
  startsOn: '',
  endsOn: '',
  motif: undefined as number | undefined,
  palette: undefined as number | undefined,
})

const busy = ref(false)
const errorMessage = ref('')

// Voraussetzungen: eigener Speichervorgang, eigener Fehlerzustand (FV-17, Tech Design) – ein
// Fehler hier soll das Speichern der übrigen Felder oben nicht blockieren.
const prerequisiteOptions = computed(() =>
  (allCoursesData.value?.items ?? [])
    .filter(item => item.id !== id.value)
    .map(item => ({ label: item.title, id: item.id })),
)
const selectedPrerequisites = ref<string[]>([])
const prerequisitesBusy = ref(false)
const prerequisitesError = ref('')

watchEffect(() => {
  selectedPrerequisites.value = (prerequisitesData.value?.items ?? []).map(item => item.id)
})

async function savePrerequisites() {
  prerequisitesBusy.value = true
  prerequisitesError.value = ''
  try {
    await $fetch(`/api/admin/courses/${id.value}/prerequisites`, {
      method: 'PUT',
      body: { requiredCourseIds: selectedPrerequisites.value },
    })
    toast.add({ title: 'Voraussetzungen gespeichert', color: 'success' })
    await refreshPrerequisites()
  }
  catch (error) {
    prerequisitesError.value = (error as { statusMessage?: string }).statusMessage
      ?? 'Speichern der Voraussetzungen fehlgeschlagen.'
  }
  finally {
    prerequisitesBusy.value = false
  }
}

const MAIL_ICONS: Record<string, string> = {
  versendet: 'i-lucide-mail-check',
  fehlgeschlagen: 'i-lucide-mail-x',
  nicht_versendet: 'i-lucide-mail-question-mark',
}
const MAIL_STATUS_LABELS: Record<string, string> = {
  versendet: 'Versendet',
  fehlgeschlagen: 'Fehlgeschlagen',
  nicht_versendet: 'Nicht versendet',
}
const mailVersandAktiv = computed(
  () => !mailData.value?.items?.some(mail => mail.status === 'nicht_versendet'),
)

function isoOf(value: string | number | Date) {
  return new Date(value).toISOString().slice(0, 10)
}

watchEffect(() => {
  if (!course.value) return
  state.title = course.value.title
  state.summary = course.value.summary ?? ''
  state.description = course.value.description ?? ''
  state.startsOn = isoOf(course.value.startsOn)
  state.endsOn = isoOf(course.value.endsOn)
  state.motif = course.value.motif ?? undefined
  state.palette = course.value.palette ?? undefined
})

async function save() {
  busy.value = true
  errorMessage.value = ''
  try {
    await $fetch(`/api/admin/courses/${id.value}`, {
      method: 'PATCH',
      body: {
        title: state.title,
        summary: state.summary || undefined,
        description: state.description || undefined,
        startsOn: state.startsOn,
        endsOn: state.endsOn,
        motif: state.motif ?? null,
        palette: state.palette ?? null,
      },
    })
    toast.add({ title: 'Gespeichert', color: 'success' })
    await refresh()
  }
  catch (error) {
    errorMessage.value = (error as { statusMessage?: string }).statusMessage
      ?? 'Speichern fehlgeschlagen.'
  }
  finally {
    busy.value = false
  }
}

async function toggleCancelled() {
  const cancelled = course.value?.status !== 'abgesagt'
  try {
    await $fetch(`/api/admin/courses/${id.value}/cancel`, { method: 'POST', body: { cancelled } })
    toast.add({
      title: cancelled ? 'Lehrgang abgesagt' : 'Absage zurückgenommen',
      description: cancelled
        ? 'Die Interessenten wurden benachrichtigt – siehe Mailprotokoll.'
        : undefined,
      color: 'success',
    })
    await refresh()
    await refreshMails()
  }
  catch (error) {
    toast.add({
      title: (error as { statusMessage?: string }).statusMessage ?? 'Aktion fehlgeschlagen.',
      color: 'error',
    })
  }
}

async function removeCourse() {
  try {
    await $fetch(`/api/admin/courses/${id.value}`, { method: 'DELETE' })
    toast.add({ title: 'Lehrgang gelöscht', color: 'success' })
    await router.push('/verwaltung')
  }
  catch (error) {
    toast.add({
      title: (error as { statusMessage?: string }).statusMessage ?? 'Löschen fehlgeschlagen.',
      color: 'error',
    })
  }
}
</script>

<template>
  <div v-if="course" class="space-y-6">
    <div class="flex flex-wrap items-center gap-3">
      <UButton to="/verwaltung" variant="ghost" color="neutral" icon="i-lucide-arrow-left">
        Verwaltung
      </UButton>
      <h1 class="text-xl font-semibold text-highlighted">
        {{ course.title }}
      </h1>
      <UBadge v-if="course.status === 'abgesagt'" color="error" variant="subtle">
        Abgesagt
      </UBadge>

      <div class="ml-auto flex gap-2">
        <UButton
          variant="outline"
          :color="course.status === 'abgesagt' ? 'neutral' : 'warning'"
          data-testid="course-cancel-toggle"
          @click="toggleCancelled"
        >
          {{ course.status === 'abgesagt' ? 'Absage zurücknehmen' : 'Absagen' }}
        </UButton>
        <UButton
          variant="outline"
          color="error"
          data-testid="course-delete"
          @click="removeCourse"
        >
          Löschen
        </UButton>
      </div>
    </div>

    <div class="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div class="space-y-5 rounded-lg border border-default bg-default p-5">
        <UFormField label="Titel">
          <UInput v-model="state.title" class="w-full" data-testid="edit-title" />
        </UFormField>

        <UFormField label="Kurzbeschreibung" description="Erscheint auf der Karte in der Übersicht.">
          <UInput v-model="state.summary" class="w-full" />
        </UFormField>

        <UFormField label="Beschreibung">
          <UTextarea v-model="state.description" :rows="5" class="w-full" data-testid="edit-description" />
        </UFormField>
      </div>

      <aside class="space-y-4">
        <div class="space-y-4 rounded-lg border border-default bg-default p-5">
          <UFormField label="Zeitraum">
            <AdminCourseDateRangeField v-model:starts-on="state.startsOn" v-model:ends-on="state.endsOn" />
          </UFormField>
        </div>

        <div class="rounded-lg border border-default bg-default p-5">
          <h2 class="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
            Titelbild
          </h2>
          <AdminMotifPicker
            v-model:motif="state.motif"
            v-model:palette="state.palette"
            :title="state.title"
          />
        </div>

        <div class="space-y-3 rounded-lg border border-default bg-default p-5" data-testid="prerequisites-section">
          <h2 class="text-sm font-semibold uppercase tracking-wide text-muted">
            Voraussetzungen
          </h2>
          <UFormField label="Vorher abzuschließende Lehrgänge">
            <USelectMenu
              v-model="selectedPrerequisites"
              :items="prerequisiteOptions"
              value-key="id"
              multiple
              class="w-full"
              placeholder="Keine Voraussetzungen"
              data-testid="prerequisites-select"
            />
          </UFormField>
          <UAlert
            v-if="prerequisitesError"
            color="error"
            variant="subtle"
            :title="prerequisitesError"
            data-testid="prerequisites-error"
          />
          <UButton
            block
            variant="outline"
            :loading="prerequisitesBusy"
            :disabled="prerequisitesBusy"
            data-testid="prerequisites-save"
            @click="savePrerequisites"
          >
            Voraussetzungen speichern
          </UButton>
        </div>

        <section
          v-if="mailData?.items?.length"
          class="rounded-lg border border-default bg-default p-5"
          data-testid="mail-log"
        >
          <h2 class="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
            Mailprotokoll
          </h2>
          <ul class="space-y-2 text-sm">
            <li
              v-for="mail in mailData.items"
              :key="mail.id"
              class="flex items-start gap-2"
            >
              <UIcon
                :name="MAIL_ICONS[mail.status] ?? 'i-lucide-mail'"
                class="mt-0.5 size-4 shrink-0"
                :class="mail.status === 'versendet' ? 'text-green-600'
                  : mail.status === 'fehlgeschlagen' ? 'text-fire-600' : 'text-dimmed'"
              />
              <div class="min-w-0">
                <p class="truncate text-highlighted">
                  {{ mail.recipient }}
                </p>
                <p class="text-xs text-muted">
                  {{ MAIL_STATUS_LABELS[mail.status] }} · {{ mail.template }}
                </p>
              </div>
            </li>
          </ul>
          <p v-if="!mailVersandAktiv" class="mt-3 text-xs text-muted">
            Es ist kein Mailserver hinterlegt – die Nachrichten wurden nur protokolliert.
          </p>
        </section>

        <UAlert v-if="errorMessage" color="error" variant="subtle" :title="errorMessage" data-testid="edit-error" />

        <UButton
          block
          size="lg"
          :loading="busy"
          :disabled="busy"
          data-testid="edit-save"
          @click="save"
        >
          Speichern
        </UButton>
      </aside>
    </div>
  </div>
</template>
