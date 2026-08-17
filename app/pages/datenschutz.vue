<script setup lang="ts">
/** Statische Datenschutzseite für den Link in der Einwilligung (FV-5; ausgebaut in FV-8). */
definePageMeta({ layout: 'blank' })

const { organisation } = useRuntimeConfig().public
useHead({ title: 'Datenschutz' })
</script>

<template>
  <div class="min-h-screen px-6 py-12">
    <article class="mx-auto max-w-2xl space-y-6">
      <div>
        <UButton to="/" variant="ghost" color="neutral" icon="i-lucide-arrow-left">
          Zurück
        </UButton>
      </div>

      <h1 class="text-2xl font-semibold text-highlighted">
        Datenschutz
      </h1>

      <section class="space-y-3 text-sm text-toned">
        <h2 class="text-base font-semibold text-highlighted">
          Welche Daten wir speichern
        </h2>
        <p>
          Wenn Sie Interesse an einem Lehrgang bekunden, speichern wir Vorname, Nachname und
          E-Mail-Adresse sowie den Zeitpunkt Ihrer Einwilligung. Weitere Angaben erheben wir nicht.
        </p>

        <h2 class="text-base font-semibold text-highlighted">
          Wozu wir sie verwenden
        </h2>
        <p>
          Ausschließlich zur Bearbeitung Ihrer Anmeldung: Zuteilung eines Platzes, Rückmeldung per
          E-Mail sowie Benachrichtigung bei Absage oder Terminänderung. Es findet keine Auswertung
          zu anderen Zwecken statt, und die Daten werden nicht weitergegeben.
        </p>

        <h2 class="text-base font-semibold text-highlighted">
          Wie lange
        </h2>
        <p>
          Die Angaben werden zwölf Monate nach Ende des jeweiligen Lehrgangs automatisch gelöscht.
          Sie können sich jederzeit über den Link in unseren E-Mails selbst abmelden; die
          Anmeldung gilt dann als storniert.
        </p>

        <h2 class="text-base font-semibold text-highlighted">
          Wer verantwortlich ist
        </h2>
        <p>
          {{ organisation.name }}. Für Auskunft, Berichtigung oder Löschung wenden Sie sich bitte an
          die Wehrführung.
        </p>
      </section>

      <p class="text-xs text-muted">
        Diese Seite ist ein fachlicher Entwurf und ersetzt keine Rechtsberatung. Vor dem
        produktiven Betrieb bitte durch die Gemeinde prüfen lassen.
      </p>
    </article>
  </div>
</template>
