<script setup lang="ts">
import { CATEGORIES, CATEGORY_LABELS, FORMATS, FORMAT_LABELS } from '#shared/constants'
import { createCourseSchema } from '#shared/validation/course'

const open = defineModel<boolean>('open', { required: true })
const props = defineProps<{ date?: string }>()
const emit = defineEmits<{ created: [] }>()

const toast = useToast()
const { data: instructorData } = await useFetch('/api/admin/instructors')

const state = reactive({
  title: '',
  startsOn: props.date ?? '',
  endsOn: props.date ?? '',
  category: CATEGORIES[0] as (typeof CATEGORIES)[number],
  format: FORMATS[0] as (typeof FORMATS)[number],
  timeLabel: '',
  location: '',
  capacity: 0,
  instructorId: 'ohne' as string | undefined,
  motif: undefined as number | undefined,
  palette: undefined as number | undefined,
})

const busy = ref(false)
const errorMessage = ref('')

watch(() => props.date, (value) => {
  if (!value) return
  state.startsOn = value
  if (!state.endsOn || state.endsOn < value) state.endsOn = value
})

const categoryOptions = CATEGORIES.map(value => ({ value, label: CATEGORY_LABELS[value] }))
const formatOptions = FORMATS.map(value => ({ value, label: FORMAT_LABELS[value] }))
// Nuxt UI erlaubt keinen leeren String als Auswahlwert (siehe Editor-Seite).
const OHNE_AUSBILDER = 'ohne'

const instructorOptions = computed(() => [
  { value: OHNE_AUSBILDER, label: 'Ohne Ausbilder' },
  ...(instructorData.value?.items ?? []).map(item => ({ value: item.id, label: item.name })),
])

const durationHint = computed(() => {
  if (!state.startsOn || !state.endsOn) return ''
  const days = Math.round(
    (new Date(state.endsOn).getTime() - new Date(state.startsOn).getTime()) / 86_400_000,
  ) + 1
  if (days < 1) return 'Das Ende darf nicht vor dem Beginn liegen.'
  return days === 1 ? 'Ein Tag' : `${days} Tage`
})

async function onSubmit() {
  busy.value = true
  errorMessage.value = ''
  try {
    await $fetch('/api/admin/courses', {
      method: 'POST',
      body: {
        ...state,
        instructorId: state.instructorId === OHNE_AUSBILDER ? undefined : state.instructorId,
        timeLabel: state.timeLabel || undefined,
        location: state.location || undefined,
      },
    })
    toast.add({ title: 'Lehrgang angelegt', color: 'success' })
    open.value = false
    emit('created')
  }
  catch (error) {
    errorMessage.value = (error as { statusMessage?: string }).statusMessage
      ?? 'Der Lehrgang konnte nicht angelegt werden.'
  }
  finally {
    busy.value = false
  }
}
</script>

<template>
  <UModal v-model:open="open" title="Neuer Lehrgang" :ui="{ content: 'max-w-2xl' }">
    <template #body>
      <UForm
        :schema="createCourseSchema"
        :state="state"
        class="space-y-4"
        data-testid="course-create-form"
        @submit="onSubmit"
      >
        <UFormField label="Titel" name="title" required>
          <UInput
            v-model="state.title"
            placeholder="z. B. Truppmann Grundausbildung"
            class="w-full"
            data-testid="course-title-input"
          />
        </UFormField>

        <div class="grid gap-4 sm:grid-cols-2">
          <UFormField label="Beginn" name="startsOn" required>
            <UInput v-model="state.startsOn" type="date" class="w-full" data-testid="course-start-input" />
          </UFormField>
          <UFormField label="Ende" name="endsOn" required :description="durationHint">
            <UInput v-model="state.endsOn" type="date" class="w-full" data-testid="course-end-input" />
          </UFormField>
        </div>

        <div class="grid gap-4 sm:grid-cols-2">
          <UFormField label="Kategorie" name="category" required>
            <USelect v-model="state.category" :items="categoryOptions" class="w-full" />
          </UFormField>
          <UFormField label="Format" name="format" required>
            <USelect v-model="state.format" :items="formatOptions" class="w-full" />
          </UFormField>
        </div>

        <div class="grid gap-4 sm:grid-cols-2">
          <UFormField label="Uhrzeit (täglich)" name="timeLabel">
            <UInput v-model="state.timeLabel" placeholder="09:00 – 12:00" class="w-full" />
          </UFormField>
          <UFormField label="Plätze" name="capacity" description="0 = unbegrenzt">
            <UInput v-model.number="state.capacity" type="number" min="0" class="w-full" data-testid="course-capacity-input" />
          </UFormField>
        </div>

        <div class="grid gap-4 sm:grid-cols-2">
          <UFormField label="Ausbilder" name="instructorId">
            <USelect v-model="state.instructorId" :items="instructorOptions" class="w-full" />
          </UFormField>
          <UFormField label="Ort" name="location">
            <UInput v-model="state.location" placeholder="Gerätehaus" class="w-full" />
          </UFormField>
        </div>

        <UFormField label="Titelbild" name="motif">
          <AdminMotifPicker
            v-model:motif="state.motif"
            v-model:palette="state.palette"
            :title="state.title"
          />
        </UFormField>

        <UAlert
          v-if="errorMessage"
          color="error"
          variant="subtle"
          :title="errorMessage"
          data-testid="course-create-error"
        />

        <div class="flex justify-end gap-2 pt-2">
          <UButton variant="ghost" color="neutral" @click="open = false">
            Abbrechen
          </UButton>
          <UButton
            type="submit"
            :loading="busy"
            :disabled="busy"
            data-testid="course-create-submit"
          >
            Lehrgang anlegen
          </UButton>
        </div>
      </UForm>
    </template>
  </UModal>
</template>
