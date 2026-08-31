<script setup lang="ts">
definePageMeta({ layout: 'admin' })

const route = useRoute()
const router = useRouter()
const toast = useToast()
const id = computed(() => String(route.params.id))

const { data: course, refresh } = await useFetch(() => `/api/courses/${id.value}`)
const { data: mailData, refresh: refreshMails } = await useFetch(() => `/api/admin/courses/${id.value}/mails`)

useHead({ title: () => `${course.value?.title ?? 'Lehrgang'} bearbeiten` })

const state = reactive({
  title: '',
  summary: '',
  description: '',
  topics: [] as string[],
  startsOn: '',
  endsOn: '',
  motif: undefined as number | undefined,
  palette: undefined as number | undefined,
  days: [] as { dayNumber: number, date: string, timeLabel: string, title: string, bullets: string[] }[],
})

const busy = ref(false)
const errorMessage = ref('')
const newTopic = ref('')

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
  state.topics = [...(course.value.topics ?? [])]
  state.startsOn = isoOf(course.value.startsOn)
  state.endsOn = isoOf(course.value.endsOn)
  state.motif = course.value.motif ?? undefined
  state.palette = course.value.palette ?? undefined
  state.days = course.value.days.map(day => ({
    dayNumber: day.dayNumber,
    date: day.date ? isoOf(day.date) : '',
    timeLabel: day.timeLabel ?? '',
    title: day.title,
    bullets: [...(day.bullets ?? [])],
  }))
})

function addTopic() {
  const value = newTopic.value.trim()
  if (!value) return
  state.topics.push(value)
  newTopic.value = ''
}

function addDay() {
  state.days.push({
    dayNumber: state.days.length + 1,
    date: state.startsOn,
    timeLabel: '',
    title: '',
    bullets: [],
  })
}

function moveDay(index: number, delta: number) {
  const target = index + delta
  if (target < 0 || target >= state.days.length) return
  const [day] = state.days.splice(index, 1)
  state.days.splice(target, 0, day!)
  state.days.forEach((entry, position) => {
    entry.dayNumber = position + 1
  })
}

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
        topics: state.topics,
        startsOn: state.startsOn,
        endsOn: state.endsOn,
        motif: state.motif ?? null,
        palette: state.palette ?? null,
        days: state.days
          .filter(day => day.title.trim())
          .map((day, index) => ({
            dayNumber: index + 1,
            date: day.date || undefined,
            timeLabel: day.timeLabel || undefined,
            title: day.title,
            bullets: day.bullets.filter(Boolean),
          })),
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

        <UFormField label="Themen">
          <div class="space-y-2">
            <div
              v-for="(topic, index) in state.topics"
              :key="`${topic}-${index}`"
              class="flex items-center gap-2"
            >
              <UInput v-model="state.topics[index]" class="flex-1" />
              <UButton
                icon="i-lucide-trash-2"
                variant="ghost"
                color="neutral"
                aria-label="Thema entfernen"
                @click="state.topics.splice(index, 1)"
              />
            </div>
            <div class="flex gap-2">
              <UInput
                v-model="newTopic"
                placeholder="Thema hinzufügen"
                class="flex-1"
                data-testid="edit-new-topic"
                @keydown.enter.prevent="addTopic"
              />
              <UButton variant="outline" color="neutral" @click="addTopic">
                Hinzufügen
              </UButton>
            </div>
          </div>
        </UFormField>

        <section>
          <div class="flex items-center gap-2">
            <h2 class="text-sm font-semibold uppercase tracking-wide text-muted">
              Programm
            </h2>
            <UButton
              size="xs"
              variant="outline"
              color="neutral"
              class="ml-auto"
              data-testid="edit-add-day"
              @click="addDay"
            >
              Tag hinzufügen
            </UButton>
          </div>

          <div class="mt-3 space-y-3">
            <div
              v-for="(day, index) in state.days"
              :key="index"
              class="rounded-lg border border-default p-3"
              data-testid="edit-day"
            >
              <div class="flex items-center gap-2">
                <span class="text-sm font-semibold text-fire-600">Tag {{ index + 1 }}</span>
                <UButton
                  icon="i-lucide-chevron-up"
                  size="xs"
                  variant="ghost"
                  color="neutral"
                  aria-label="Nach oben"
                  class="ml-auto"
                  @click="moveDay(index, -1)"
                />
                <UButton
                  icon="i-lucide-chevron-down"
                  size="xs"
                  variant="ghost"
                  color="neutral"
                  aria-label="Nach unten"
                  @click="moveDay(index, 1)"
                />
                <UButton
                  icon="i-lucide-trash-2"
                  size="xs"
                  variant="ghost"
                  color="neutral"
                  aria-label="Tag entfernen"
                  @click="state.days.splice(index, 1)"
                />
              </div>

              <div class="mt-2 grid gap-2 sm:grid-cols-3">
                <UInput v-model="day.date" type="date" />
                <UInput v-model="day.timeLabel" placeholder="09:00 – 12:00" />
                <UInput v-model="day.title" placeholder="Titel des Tages" class="sm:col-span-1" />
              </div>
            </div>
          </div>
        </section>
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
