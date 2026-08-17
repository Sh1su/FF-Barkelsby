<script setup lang="ts">
import { createUserSchema } from '#shared/validation/user'
import { PASSWORD_MIN_LENGTH } from '#shared/constants'

/** Dritter Tab der Verwaltung: Gast-Zugang und Admin-Konten pflegen (FV-7). */
const toast = useToast()
const { user: angemeldet } = useUserSession()

const { data, status, error, refresh } = await useFetch('/api/admin/users', {
  query: { limit: 100 },
})
const konten = computed(() => data.value?.items ?? [])

const anlegenOffen = ref(false)
const neuerAdmin = reactive({ email: '', displayName: '', password: '' })
const anlegenFehler = ref('')
const busyId = ref('')

const passwortDialogFuer = ref<string>('')
const neuesPasswort = ref('')
const passwortFehler = ref('')

// Passwoerter stehen standardmaessig verdeckt: die Kontenliste wird auch mal am Beamer im
// Geraetehaus geoeffnet. Wer das Startpasswort weitergeben muss, blendet es bewusst ein.
const passwortSichtbar = ref(false)
const startpasswortSichtbar = ref(false)

const kennungDialogFuer = ref<string>('')
const neueKennung = ref('')
const kennungFehler = ref('')

const gastKonto = computed(() => konten.value.find(konto => konto.role === 'guest'))
const adminKonten = computed(() => konten.value.filter(konto => konto.role === 'admin'))
const aktiveAdmins = computed(() => adminKonten.value.filter(konto => konto.active).length)

async function anlegen() {
  anlegenFehler.value = ''
  try {
    await $fetch('/api/admin/users', { method: 'POST', body: neuerAdmin })
    toast.add({ title: 'Konto angelegt', description: 'Beim ersten Anmelden wird das Passwort gewechselt.', color: 'success' })
    anlegenOffen.value = false
    Object.assign(neuerAdmin, { email: '', displayName: '', password: '' })
    await refresh()
  }
  catch (fehler) {
    anlegenFehler.value = (fehler as { statusMessage?: string }).statusMessage
      ?? 'Das Konto konnte nicht angelegt werden.'
  }
}

async function aendern(id: string, body: Record<string, unknown>, meldung: string) {
  busyId.value = id
  try {
    await $fetch(`/api/admin/users/${id}`, { method: 'PATCH', body })
    toast.add({ title: meldung, color: 'success' })
    await refresh()
    return true
  }
  catch (fehler) {
    toast.add({
      title: (fehler as { statusMessage?: string }).statusMessage ?? 'Das hat nicht geklappt.',
      color: 'error',
    })
    return false
  }
  finally {
    busyId.value = ''
  }
}

async function passwortSpeichern() {
  passwortFehler.value = ''
  if (neuesPasswort.value.length < PASSWORD_MIN_LENGTH) {
    passwortFehler.value = `Mindestens ${PASSWORD_MIN_LENGTH} Zeichen.`
    return
  }

  const erfolg = await aendern(passwortDialogFuer.value, { password: neuesPasswort.value }, 'Passwort gesetzt')
  if (erfolg) {
    passwortDialogFuer.value = ''
    neuesPasswort.value = ''
  }
}

async function kennungSpeichern() {
  kennungFehler.value = ''
  const erfolg = await aendern(kennungDialogFuer.value, { email: neueKennung.value }, 'Kennung geändert')
  if (erfolg) {
    kennungDialogFuer.value = ''
    neueKennung.value = ''
  }
}
</script>

<template>
  <section class="space-y-6" data-testid="user-registry">
    <div class="flex flex-wrap items-center gap-3">
      <p class="text-sm text-muted">
        {{ aktiveAdmins }} aktive Verwaltungskonten · 1 geteilter Gast-Zugang
      </p>
      <!-- min-h-11 = 44px: Mindestgroesse fuer Bedienelemente auf dem Handy (.claude/rules/testing.md) -->
      <UButton
        icon="i-lucide-user-plus"
        class="min-h-11 sm:ml-auto"
        data-testid="user-new"
        @click="startpasswortSichtbar = false; anlegenOffen = true"
      >
        Admin anlegen
      </UButton>
    </div>

    <UAlert
      v-if="error"
      color="error"
      variant="subtle"
      title="Die Kontenliste konnte nicht geladen werden."
      :description="error.statusMessage ?? 'Bitte die Seite neu laden.'"
      data-testid="user-error"
    />

    <div v-else-if="status === 'pending'" class="space-y-2" data-testid="user-loading">
      <USkeleton v-for="zeile in 3" :key="zeile" class="h-12 w-full" />
    </div>

    <UAlert
      v-else-if="konten.length === 0"
      color="warning"
      variant="subtle"
      title="Keine Konten vorhanden."
      description="Das sollte nicht vorkommen – ohne Gast-Zugang sieht die Wehr keine Lehrgänge. Bitte den Serverstart prüfen."
      data-testid="user-empty"
    />

    <div v-else class="overflow-x-auto rounded-lg border border-default bg-default">
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b border-default text-left text-xs uppercase tracking-wide text-muted">
            <th class="px-4 py-3 font-semibold">Kennung</th>
            <th class="px-4 py-3 font-semibold">Name</th>
            <th class="px-4 py-3 font-semibold">Rolle</th>
            <th class="px-4 py-3 font-semibold">Zustand</th>
            <th class="px-4 py-3 text-right font-semibold">Aktionen</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="konto in konten"
            :key="konto.id"
            class="border-b border-default last:border-0"
            data-testid="user-row"
          >
            <td class="px-4 py-3 font-medium text-highlighted">
              {{ konto.email }}
            </td>
            <td class="px-4 py-3 text-toned">
              {{ konto.displayName }}
            </td>
            <td class="px-4 py-3">
              <UBadge :color="konto.role === 'admin' ? 'primary' : 'neutral'" variant="subtle" size="sm">
                {{ konto.role === 'admin' ? 'Verwaltung' : 'Gast-Zugang' }}
              </UBadge>
            </td>
            <td class="px-4 py-3">
              <UBadge :color="konto.active ? 'success' : 'neutral'" variant="subtle" size="sm">
                {{ konto.active ? 'Aktiv' : 'Deaktiviert' }}
              </UBadge>
              <UBadge
                v-if="konto.mustChangePassword"
                color="warning"
                variant="outline"
                size="sm"
                class="ml-1"
                data-testid="user-startpasswort"
              >
                Startpasswort
              </UBadge>
              <UBadge
                v-if="konto.id === angemeldet?.id"
                color="neutral"
                variant="outline"
                size="sm"
                class="ml-1"
              >
                Sie
              </UBadge>
            </td>
            <td class="px-4 py-3">
              <div class="flex flex-wrap justify-end gap-2">
                <UButton
                  variant="outline"
                  color="neutral"
                  class="min-h-11"
                  :loading="busyId === konto.id"
                  data-testid="user-password"
                  @click="passwortDialogFuer = konto.id; neuesPasswort = ''; passwortSichtbar = false"
                >
                  Passwort
                </UButton>
                <UButton
                  variant="outline"
                  color="neutral"
                  class="min-h-11"
                  :loading="busyId === konto.id"
                  data-testid="user-kennung"
                  @click="kennungDialogFuer = konto.id; neueKennung = konto.email"
                >
                  Kennung
                </UButton>
                <UButton
                  v-if="konto.role === 'admin'"
                  variant="outline"
                  class="min-h-11"
                  :color="konto.active ? 'error' : 'primary'"
                  :loading="busyId === konto.id"
                  data-testid="user-toggle"
                  @click="aendern(konto.id, { active: !konto.active }, konto.active ? 'Konto deaktiviert' : 'Konto aktiviert')"
                >
                  {{ konto.active ? 'Deaktivieren' : 'Aktivieren' }}
                </UButton>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <p class="text-xs text-muted">
      Der Gast-Zugang lässt sich nur ändern, nicht abschalten – ohne ihn sähe die Wehr keine
      Lehrgänge mehr. Ebenso bleibt immer mindestens ein Verwaltungskonto aktiv.
      <template v-if="gastKonto">
        Aktuelle Gast-Kennung: <strong>{{ gastKonto.email }}</strong>.
      </template>
    </p>

    <UModal v-model:open="anlegenOffen" title="Admin anlegen">
      <template #body>
        <UForm
          :schema="createUserSchema"
          :state="neuerAdmin"
          class="space-y-4"
          data-testid="user-create-form"
          @submit="anlegen"
        >
          <UFormField label="Kennung (E-Mail)" name="email" required>
            <UInput
              v-model="neuerAdmin.email"
              type="email"
              class="w-full"
              size="lg"
              :ui="{ base: 'min-h-11' }"
              data-testid="user-create-email"
            />
          </UFormField>
          <UFormField label="Name" name="displayName" required>
            <UInput
              v-model="neuerAdmin.displayName"
              class="w-full"
              size="lg"
              :ui="{ base: 'min-h-11' }"
              data-testid="user-create-name"
            />
          </UFormField>
          <UFormField
            label="Startpasswort"
            name="password"
            required
            :description="`Mindestens ${PASSWORD_MIN_LENGTH} Zeichen. Wird beim ersten Anmelden gewechselt.`"
          >
            <UInput
              v-model="neuerAdmin.password"
              :type="startpasswortSichtbar ? 'text' : 'password'"
              class="w-full"
              size="lg"
              :ui="{ base: 'min-h-11' }"
              data-testid="user-create-password"
            >
              <template #trailing>
                <UButton
                  variant="link"
                  color="neutral"
                  :icon="startpasswortSichtbar ? 'i-lucide-eye-off' : 'i-lucide-eye'"
                  :aria-label="startpasswortSichtbar ? 'Startpasswort verbergen' : 'Startpasswort anzeigen'"
                  data-testid="user-create-password-reveal"
                  @click="startpasswortSichtbar = !startpasswortSichtbar"
                />
              </template>
            </UInput>
          </UFormField>

          <UAlert v-if="anlegenFehler" color="error" variant="subtle" :title="anlegenFehler" data-testid="user-create-error" />

          <div class="flex justify-end gap-2">
            <UButton variant="ghost" color="neutral" class="min-h-11" @click="anlegenOffen = false">
              Abbrechen
            </UButton>
            <UButton type="submit" class="min-h-11" data-testid="user-create-submit">
              Konto anlegen
            </UButton>
          </div>
        </UForm>
      </template>
    </UModal>

    <UModal
      :open="passwortDialogFuer !== ''"
      title="Neues Passwort setzen"
      @update:open="passwortDialogFuer = ''"
    >
      <template #body>
        <div class="space-y-4">
          <UFormField label="Neues Passwort" :description="`Mindestens ${PASSWORD_MIN_LENGTH} Zeichen.`">
            <UInput
              v-model="neuesPasswort"
              :type="passwortSichtbar ? 'text' : 'password'"
              class="w-full"
              size="lg"
              :ui="{ base: 'min-h-11' }"
              data-testid="user-password-input"
            >
              <template #trailing>
                <UButton
                  variant="link"
                  color="neutral"
                  :icon="passwortSichtbar ? 'i-lucide-eye-off' : 'i-lucide-eye'"
                  :aria-label="passwortSichtbar ? 'Passwort verbergen' : 'Passwort anzeigen'"
                  data-testid="user-password-reveal"
                  @click="passwortSichtbar = !passwortSichtbar"
                />
              </template>
            </UInput>
          </UFormField>
          <UAlert v-if="passwortFehler" color="error" variant="subtle" :title="passwortFehler" />
          <div class="flex justify-end gap-2">
            <UButton variant="ghost" color="neutral" class="min-h-11" @click="passwortDialogFuer = ''">
              Abbrechen
            </UButton>
            <UButton class="min-h-11" data-testid="user-password-submit" @click="passwortSpeichern">
              Passwort setzen
            </UButton>
          </div>
        </div>
      </template>
    </UModal>

    <UModal
      :open="kennungDialogFuer !== ''"
      title="Kennung ändern"
      @update:open="kennungDialogFuer = ''"
    >
      <template #body>
        <div class="space-y-4">
          <UFormField label="Kennung (E-Mail)">
            <UInput
              v-model="neueKennung"
              type="email"
              class="w-full"
              size="lg"
              :ui="{ base: 'min-h-11' }"
              data-testid="user-kennung-input"
            />
          </UFormField>
          <UAlert v-if="kennungFehler" color="error" variant="subtle" :title="kennungFehler" />
          <div class="flex justify-end gap-2">
            <UButton variant="ghost" color="neutral" class="min-h-11" @click="kennungDialogFuer = ''">
              Abbrechen
            </UButton>
            <UButton class="min-h-11" data-testid="user-kennung-submit" @click="kennungSpeichern">
              Kennung speichern
            </UButton>
          </div>
        </div>
      </template>
    </UModal>
  </section>
</template>
