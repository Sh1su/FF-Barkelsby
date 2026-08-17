<script setup lang="ts">
import { SIGNUP_STATUS_LABELS, type SignupStatus } from '#shared/constants'

/** Zweiter Tab der Verwaltung: Anmeldungen sichten und entscheiden (FV-6). */
const route = useRoute()
const router = useRouter()
const toast = useToast()

const FILTER: { value: SignupStatus | undefined, label: string }[] = [
  { value: undefined, label: 'Alle' },
  { value: 'offen', label: 'Offen' },
  { value: 'bestaetigt', label: 'Bestätigt' },
  { value: 'abgelehnt', label: 'Abgelehnt' },
]

const status = ref<SignupStatus | undefined>(
  FILTER.some(eintrag => eintrag.value === route.query.status)
    ? (route.query.status as SignupStatus)
    : undefined,
)

watch(status, (wert) => {
  router.replace({ query: { ...route.query, status: wert } })
})

const { data, status: ladezustand, refresh } = await useFetch('/api/admin/signups', {
  query: computed(() => ({ status: status.value })),
})

const eintraege = computed(() => data.value?.items ?? [])
const busyId = ref('')

const { dateRange } = useCourseFormat()
const datum = new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })

const zusammenfassung = computed(() => {
  const summary = data.value?.summary ?? {}
  const teile = (Object.keys(SIGNUP_STATUS_LABELS) as SignupStatus[])
    .filter(schluessel => (summary[schluessel] ?? 0) > 0)
    .map(schluessel => `${summary[schluessel]} ${SIGNUP_STATUS_LABELS[schluessel].toLowerCase()}`)

  return teile.length > 0 ? teile.join(' · ') : 'Noch keine Anmeldungen'
})

const STATUSFARBEN: Record<SignupStatus, 'neutral' | 'success' | 'error' | 'warning'> = {
  offen: 'warning',
  bestaetigt: 'success',
  abgelehnt: 'error',
  storniert: 'neutral',
}

async function setzeStatus(id: string, ziel: SignupStatus) {
  busyId.value = id
  try {
    await $fetch(`/api/admin/signups/${id}`, { method: 'PATCH', body: { status: ziel } })
    toast.add({
      title: ziel === 'offen' ? 'Zurückgesetzt' : `Anmeldung ${SIGNUP_STATUS_LABELS[ziel].toLowerCase()}`,
      description: ziel === 'offen' ? undefined : 'Der Teilnehmer wurde per E-Mail informiert.',
      color: 'success',
    })
    await refresh()
  }
  catch (fehler) {
    toast.add({
      title: (fehler as { statusMessage?: string }).statusMessage ?? 'Das hat nicht geklappt.',
      color: 'error',
    })
  }
  finally {
    busyId.value = ''
  }
}
</script>

<template>
  <section class="space-y-4" data-testid="signup-registry">
    <div class="flex flex-wrap gap-2" role="group" aria-label="Nach Status filtern">
      <UButton
        v-for="filter in FILTER"
        :key="filter.value ?? 'alle'"
        size="md"
        class="min-h-11 rounded-full"
        :color="status === filter.value ? 'primary' : 'neutral'"
        :variant="status === filter.value ? 'solid' : 'outline'"
        :aria-pressed="status === filter.value"
        :data-testid="`registry-filter-${filter.value ?? 'alle'}`"
        @click="status = filter.value"
      >
        {{ filter.label }}
      </UButton>
    </div>

    <p class="text-sm text-muted" data-testid="registry-summary">
      {{ zusammenfassung }}
    </p>

    <div v-if="ladezustand === 'pending'" class="space-y-2">
      <USkeleton v-for="index in 3" :key="index" class="h-14 w-full" />
    </div>

    <div
      v-else-if="eintraege.length === 0"
      class="rounded-lg border border-dashed border-accented bg-default p-10 text-center"
      data-testid="registry-empty"
    >
      <p class="font-medium text-highlighted">
        Keine Anmeldungen in dieser Ansicht
      </p>
      <p class="mt-1 text-sm text-toned">
        Sobald jemand Interesse bekundet, erscheint die Anmeldung hier.
      </p>
    </div>

    <div v-else class="overflow-x-auto rounded-lg border border-default bg-default">
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b border-default text-left text-xs uppercase tracking-wide text-muted">
            <th class="px-4 py-3 font-semibold">Name</th>
            <th class="px-4 py-3 font-semibold">E-Mail</th>
            <th class="px-4 py-3 font-semibold">Lehrgang</th>
            <th class="px-4 py-3 font-semibold">Anmeldung</th>
            <th class="px-4 py-3 font-semibold">Status</th>
            <th class="px-4 py-3 text-right font-semibold">Aktionen</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="eintrag in eintraege"
            :key="eintrag.id"
            class="border-b border-default last:border-0"
            data-testid="registry-row"
          >
            <td class="px-4 py-3 font-medium text-highlighted">
              {{ eintrag.lastName }}, {{ eintrag.firstName }}
            </td>
            <td class="px-4 py-3 text-toned">
              {{ eintrag.email }}
            </td>
            <td class="px-4 py-3 text-toned">
              <NuxtLink :to="`/verwaltung/lehrgang/${eintrag.courseId}`" class="hover:underline">
                {{ eintrag.courseTitle }}
              </NuxtLink>
              <span class="block text-xs text-muted">
                {{ dateRange(eintrag.courseStartsOn, eintrag.courseStartsOn) }}
              </span>
            </td>
            <td class="px-4 py-3 text-toned">
              {{ datum.format(new Date(eintrag.createdAt)) }}
            </td>
            <td class="px-4 py-3">
              <UBadge :color="STATUSFARBEN[eintrag.status]" variant="subtle" size="sm">
                {{ SIGNUP_STATUS_LABELS[eintrag.status] }}
              </UBadge>
              <UBadge
                v-if="eintrag.ueberKapazitaet"
                color="warning"
                variant="outline"
                size="sm"
                class="ml-1"
                data-testid="registry-over-capacity"
              >
                über Kapazität
              </UBadge>
            </td>
            <td class="px-4 py-3">
              <div class="flex justify-end gap-2">
                <template v-if="eintrag.status === 'offen'">
                  <UButton
                    size="sm"
                    :loading="busyId === eintrag.id"
                    data-testid="registry-confirm"
                    @click="setzeStatus(eintrag.id, 'bestaetigt')"
                  >
                    Bestätigen
                  </UButton>
                  <UButton
                    size="sm"
                    color="neutral"
                    variant="outline"
                    :loading="busyId === eintrag.id"
                    data-testid="registry-reject"
                    @click="setzeStatus(eintrag.id, 'abgelehnt')"
                  >
                    Ablehnen
                  </UButton>
                </template>

                <UButton
                  v-else-if="eintrag.status !== 'storniert'"
                  size="sm"
                  color="neutral"
                  variant="outline"
                  :loading="busyId === eintrag.id"
                  data-testid="registry-undo"
                  @click="setzeStatus(eintrag.id, 'offen')"
                >
                  Rückgängig
                </UButton>

                <UButton
                  :to="`/api/admin/courses/${eintrag.courseId}/signups.csv`"
                  external
                  size="sm"
                  color="neutral"
                  variant="ghost"
                  icon="i-lucide-download"
                  :aria-label="`Teilnehmerliste für ${eintrag.courseTitle} herunterladen`"
                  data-testid="registry-csv"
                />
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>
