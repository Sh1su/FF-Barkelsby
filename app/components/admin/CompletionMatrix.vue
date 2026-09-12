<script setup lang="ts">
/**
 * Vierter Tab der Verwaltung: Mitglieder x Lehrgaenge, Zellen zeigen den Abschluss-Status (FV-19).
 *
 * Bewusst **keine** Berechtigungs-/Voraussetzungs-Auswertung – siehe "Scope-Entscheidung" in
 * `features/FV-19-admin-matrix.md`. Ein Klick auf eine Zelle trägt einen Abschluss ein oder
 * entfernt ihn wieder, direkt über die bestehenden FV-18-Routen.
 */
const toast = useToast()

const { data, status, error } = await useFetch('/api/admin/matrix')

const members = computed(() => data.value?.members ?? [])
const courseList = computed(() => data.value?.courses ?? [])

// Eigene reaktive Kopie: ein Klick aktualisiert nur die betroffene Zelle (AC-3/AC-4), ohne
// die ganze Matrix per `refresh()` neu zu laden.
const completions = reactive<Record<string, Record<string, string>>>(
  structuredClone(data.value?.completions ?? {}),
)

const leer = computed(() => members.value.length === 0 || courseList.value.length === 0)

const busyCell = ref('')

function cellKey(memberId: string, courseId: string) {
  return `${memberId}:${courseId}`
}

function completedAt(memberId: string, courseId: string): string | undefined {
  return completions[memberId]?.[courseId]
}

async function toggleCell(memberId: string, courseId: string) {
  const key = cellKey(memberId, courseId)
  if (busyCell.value === key) return

  busyCell.value = key
  const bestehend = completedAt(memberId, courseId)

  try {
    if (bestehend) {
      await $fetch(`/api/admin/courses/${courseId}/completions/${memberId}`, { method: 'DELETE' })
      // Kein `delete` auf dynamisch berechnetem Schlüssel (@typescript-eslint/no-dynamic-delete)
      // – stattdessen den Eintrag ohne den Lehrgang neu aufbauen.
      const { [courseId]: _entfernt, ...rest } = completions[memberId] ?? {}
      completions[memberId] = rest
    }
    else {
      const abschluss = await $fetch<{ completedAt: string }>(
        `/api/admin/courses/${courseId}/completions`,
        { method: 'POST', body: { userId: memberId } },
      )
      completions[memberId] ??= {}
      completions[memberId]![courseId] = abschluss.completedAt
    }
  }
  catch (fehler) {
    toast.add({
      title: (fehler as { statusMessage?: string }).statusMessage ?? 'Das hat nicht geklappt.',
      color: 'error',
    })
  }
  finally {
    busyCell.value = ''
  }
}
</script>

<template>
  <section class="space-y-4" data-testid="completion-matrix">
    <p class="text-sm text-muted">
      Abschluss-Status je Mitglied und Lehrgang. Ein Klick auf eine Zelle trägt einen Abschluss
      mit dem heutigen Datum ein oder entfernt ihn wieder.
    </p>

    <UAlert
      v-if="error"
      color="error"
      variant="subtle"
      title="Die Matrix konnte nicht geladen werden."
      :description="error.statusMessage ?? 'Bitte die Seite neu laden.'"
      data-testid="matrix-error"
    />

    <div v-else-if="status === 'pending'" class="space-y-2" data-testid="matrix-loading">
      <USkeleton v-for="zeile in 3" :key="zeile" class="h-12 w-full" />
    </div>

    <UAlert
      v-else-if="leer"
      color="neutral"
      variant="subtle"
      title="Noch keine Matrix möglich."
      description="Dafür braucht es mindestens ein Mitgliedskonto und einen Lehrgang."
      data-testid="matrix-empty"
    />

    <!-- overflow-x-auto: eigener Scroll-Container statt Seiten-Scroll bei vielen Lehrgaengen
         (AC-5, Konvention aus UserRegistry.vue). -->
    <div v-else class="overflow-x-auto rounded-lg border border-default bg-default">
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b border-default text-left text-xs uppercase tracking-wide text-muted">
            <th class="sticky left-0 z-10 bg-default px-4 py-3 font-semibold">Mitglied</th>
            <th
              v-for="course in courseList"
              :key="course.id"
              class="whitespace-nowrap px-4 py-3 font-semibold"
              data-testid="matrix-course-header"
            >
              {{ course.title }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="member in members"
            :key="member.id"
            class="border-b border-default last:border-0"
            data-testid="matrix-member-row"
            :class="!member.active && 'opacity-60'"
          >
            <td class="sticky left-0 z-10 bg-default px-4 py-3 font-medium text-highlighted">
              {{ member.displayName }}
              <UBadge
                v-if="!member.active"
                color="neutral"
                variant="subtle"
                size="sm"
                class="ml-1"
                data-testid="matrix-member-inactive"
              >
                Deaktiviert
              </UBadge>
            </td>
            <td v-for="course in courseList" :key="course.id" class="px-2 py-2 text-center">
              <button
                type="button"
                class="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md border border-default transition-colors"
                :class="completedAt(member.id, course.id)
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'text-muted hover:bg-elevated'"
                :disabled="busyCell === cellKey(member.id, course.id)"
                :aria-pressed="Boolean(completedAt(member.id, course.id))"
                :aria-label="`${member.displayName} – ${course.title}: ${completedAt(member.id, course.id) ? 'abgeschlossen' : 'nicht abgeschlossen'}`"
                data-testid="matrix-cell"
                @click="toggleCell(member.id, course.id)"
              >
                <UIcon v-if="completedAt(member.id, course.id)" name="i-lucide-check" class="size-4" />
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>
