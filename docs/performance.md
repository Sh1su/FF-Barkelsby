# Performance Monitoring (Nuxt)

## Lighthouse-Check (nach jedem Deployment)

1. Chrome DevTools öffnen (F12)
2. Tab "Lighthouse"
3. Auswählen: Performance, Accessibility, Best Practices, SEO
4. Report für Mobile und Desktop erzeugen
5. **Ziel: Score > 90** in allen Kategorien

Zusätzlich vor jedem Release: `npx nuxi analyze` – zeigt die Bundle-Größe pro Chunk.

## Typische Performance-Probleme

### Nicht optimierte Bilder
```vue
<!-- Schlecht: keine Optimierung, kein Lazy Loading -->
<img src="/logo-gross.jpg" />

<!-- Gut: @nuxt/image -->
<NuxtImg src="/logo-gross.jpg" width="800" height="600" loading="lazy" alt="Beschreibung" />
```
`@nuxt/image` skaliert, liefert WebP/AVIF und lädt verzögert. Im Container den lokalen `ipx`-Provider
verwenden – keine externen Bild-CDNs.

### Zu großes JavaScript-Bundle
Schwere Komponenten (Charts, PDF-Vorschau, Kalender) nur laden, wenn sie gebraucht werden:
```vue
<!-- Nuxt lädt Lazy-Komponenten erst bei Bedarf -->
<LazyReportChart v-if="showChart" :data="stats" hydrate-on-visible />
```
Große Bibliotheken (z. B. PDF-Erzeugung, Excel-Export) gehören ins Backend, nicht ins Client-Bundle.

### Fehlende Ladezustände
```vue
<script setup lang="ts">
const { data, status } = await useFetch('/api/participations')
</script>

<template>
  <USkeleton v-if="status === 'pending'" class="h-12 w-full" />
  <ParticipationList v-else-if="data?.items.length" :items="data.items" />
  <UAlert v-else title="Noch keine Fortbildungen beantragt" />
</template>
```

### Keine Caching-Strategie
Teure, selten wechselnde Abfragen serverseitig cachen:
```ts
// server/api/statistics.get.ts
export default defineCachedEventHandler(async (event) => {
  await requireUserSession(event)
  return await buildYearStatistics()
}, { maxAge: 60 * 15, name: 'year-statistics' })
```
Achtung: `defineCachedEventHandler` cacht pro Key – bei nutzerabhängigen Antworten den Key um die
Nutzer- oder Rollenkennung erweitern oder gar nicht cachen.

### Zu viel Client-Rendering
- Seiten standardmäßig serverseitig rendern lassen; `ssr: false` nur für echte Dashboard-Ausnahmen
- Statische Seiten (Hilfe, Impressum) über `routeRules: { '/hilfe': { prerender: true } }`
- Reine Lesetabellen brauchen keine Client-Hydration – `<NuxtClientFallback>` bzw. Server-Komponenten prüfen

### Langsame API-Antworten
Die häufigste Ursache sind fehlende Indizes oder N+1-Abfragen – siehe `docs/database-optimization.md`.
Antwortzeiten pro Route messen (Nitro-Plugin mit `onRequest`/`onAfterResponse`) und Ausreißer > 300 ms prüfen.

## Quick-Wins-Checkliste
- [ ] Alle Bilder über `<NuxtImg>` / `@nuxt/image`
- [ ] Schwere Komponenten als `<Lazy…>` mit `hydrate-on-visible`
- [ ] Loading-, Error- und Empty-States überall vorhanden
- [ ] Schriften über `@nuxt/fonts` lokal eingebunden (keine externen Google-Fonts – DSGVO + Offline-Betrieb)
- [ ] Listen paginiert, keine unbegrenzten Abfragen
- [ ] Indizes für alle Filter-/Sortierspalten vorhanden
- [ ] `npx nuxi analyze` zeigt keinen unerwartet großen Chunk
- [ ] Keine externen Ressourcen zur Laufzeit (Fonts, Icons, CDNs) – die App muss offline laufen

## Laufendes Monitoring (self-hosted)
- **Nitro-Timing-Logs:** Dauer je Route strukturiert nach stdout loggen, im Container-Log auswertbar
- **Health-Endpunkt:** `/api/health` prüft DB-Zugriff und liefert Version + Uptime
- **Web Vitals:** optional über `nuxt-web-vitals` oder eine eigene `/api/vitals`-Route in die SQLite-DB schreiben
- **Container-Metriken:** `docker stats`, bei Bedarf Prometheus/Grafana neben der App im Compose-Stack
