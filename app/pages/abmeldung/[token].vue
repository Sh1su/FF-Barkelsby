<script setup lang="ts">
/**
 * Öffentliche Abmeldeseite (FV-5, AC-8/AC-9).
 * Erreichbar ohne Anmeldung – der Zufallstoken aus der E-Mail ist der Nachweis.
 */
definePageMeta({ layout: 'blank' })

const route = useRoute()
const token = computed(() => String(route.params.token))
const { organisation } = useRuntimeConfig().public

useHead({ title: 'Abmeldung' })

const { data: signup, error } = await useFetch(() => `/api/abmeldung/${token.value}`)

const busy = ref(false)
const storniert = ref(false)
const fehler = ref('')

const bereitsStorniert = computed(() => signup.value?.status === 'storniert' || storniert.value)

const { dateRange } = useCourseFormat()

async function abmelden() {
  busy.value = true
  fehler.value = ''
  try {
    await $fetch(`/api/abmeldung/${token.value}`, { method: 'POST' })
    storniert.value = true
  }
  catch (fehlerObjekt) {
    fehler.value = (fehlerObjekt as { statusMessage?: string }).statusMessage
      ?? 'Die Abmeldung hat nicht geklappt. Bitte bei der Wehrführung melden.'
  }
  finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-navy-950 px-6 py-12">
    <div class="w-full max-w-md rounded-xl bg-default p-8 shadow-xl ring-1 ring-default">
      <!-- Ohne gültigen Token gibt es keinerlei Auskunft (AC-9). -->
      <div v-if="error" data-testid="abmeldung-unbekannt">
        <h1 class="text-xl font-semibold text-highlighted">
          Link nicht gültig
        </h1>
        <p class="mt-2 text-sm text-toned">
          Dieser Abmelde-Link ist unbekannt oder nicht mehr gültig. Bitte wenden Sie sich an die
          Wehrführung.
        </p>
      </div>

      <div v-else-if="signup" class="space-y-4">
        <h1 class="text-xl font-semibold text-highlighted">
          {{ bereitsStorniert ? 'Abgemeldet' : 'Wirklich abmelden?' }}
        </h1>

        <p class="text-sm text-toned">
          <template v-if="bereitsStorniert">
            Ihre Anmeldung für <strong>{{ signup.courseTitle }}</strong> ist storniert. Sie können
            sich jederzeit erneut anmelden, solange der Lehrgang stattfindet.
          </template>
          <template v-else>
            Hallo {{ signup.firstName }}, hiermit nehmen Sie Ihre Anmeldung für
            <strong>{{ signup.courseTitle }}</strong> ({{ dateRange(signup.startsOn, signup.endsOn) }})
            zurück.
          </template>
        </p>

        <UAlert v-if="fehler" color="error" variant="subtle" :title="fehler" />

        <UButton
          v-if="!bereitsStorniert"
          block
          size="lg"
          color="error"
          :loading="busy"
          :disabled="busy"
          data-testid="abmeldung-bestaetigen"
          @click="abmelden"
        >
          Jetzt abmelden
        </UButton>

        <p v-else class="text-sm text-muted" data-testid="abmeldung-erfolg">
          Danke für die Rückmeldung.
        </p>
      </div>

      <p class="mt-6 text-xs text-muted">
        {{ organisation.name }}
      </p>
    </div>
  </div>
</template>
