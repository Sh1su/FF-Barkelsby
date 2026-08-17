# Feature Specifications

Dieser Ordner enthält detaillierte Feature Specs vom Requirements Engineer für die **Fortbildungsverwaltung**.

## Naming Convention
`FV-X-feature-name.md`

Beispiele:
- `FV-1-authentifizierung.md`
- `FV-3-fortbildungskatalog.md`
- `FV-5-teilnahmen-und-nachweise.md`

## Was gehört in eine Feature Spec?

### 1. User Stories
Beschreibe, was der User tun möchte:
```markdown
Als [Mitarbeiter/Führungskraft/Verwaltung/Admin] möchte ich [Aktion] um [Ziel zu erreichen]
```

### 2. Acceptance Criteria
Konkrete, testbare Kriterien:
```markdown
- [ ] Mitarbeiter kann eine Fortbildung aus dem Katalog auswählen und einen Antrag stellen
- [ ] Antrag mit Kosten über dem Restbudget der Abteilung wird mit Warnhinweis angezeigt
- [ ] Nach dem Absenden erhält die zuständige Führungskraft eine Benachrichtigung
```

### 3. Edge Cases
Was passiert bei unerwarteten Situationen:
```markdown
- Was passiert, wenn die Fortbildung bereits stattgefunden hat?
- Was passiert bei doppeltem Antrag für dieselbe Fortbildung?
- Was passiert, wenn die zuständige Führungskraft deaktiviert wurde?
- Was passiert, wenn der Zertifikats-Upload das Größenlimit überschreitet?
- Was passiert bei gleichzeitiger Bearbeitung desselben Antrags?
```

### 4. Tech Design (vom Solution Architect)
```markdown
## Database Schema (Drizzle / SQLite)
export const participations = sqliteTable('participations', { ... })

## API Routes (Nitro)
GET    /api/trainings
POST   /api/participations
PATCH  /api/participations/:id/approve

## Component Architecture (Nuxt)
pages/fortbildungen/index.vue
└── TrainingFilterBar.vue
└── TrainingList.vue
    └── TrainingCard.vue
```

### 5. QA Test Results (vom QA Engineer)
Am Ende des Feature-Dokuments fügt QA die Test-Ergebnisse hinzu:
```markdown
---

## QA Test Results

**Tested:** 2026-08-10
**App URL:** http://localhost:3000

### Acceptance Criteria Status
- [x] AC-1: Mitarbeiter kann Antrag stellen
- [x] AC-2: Führungskraft wird benachrichtigt
- [ ] ❌ BUG: Doppelter Antrag wird nicht abgelehnt

### Bugs Found
**BUG-1: Doppelter Antrag für dieselbe Fortbildung**
- **Severity:** High
- **Steps to Reproduce:** 1. Antrag stellen, 2. Seite neu laden, 3. erneut absenden
- **Expected:** Fehlermeldung "Antrag existiert bereits"
- **Actual:** Zweiter Datensatz wird angelegt
```

### 6. Deployment Status (vom DevOps Engineer)
```markdown
---

## Deployment

**Status:** ✅ Deployed
**Deployed:** 2026-08-11
**Image:** ghcr.io/org/fortbildungsverwaltung:1.0.0
**Ziel:** https://fortbildung.intern.example.org
**Git Tag:** v1.0.0-FV-1
**Migration:** 0004_add_participations.sql angewendet
```

## Workflow

1. **Requirements Engineer** erstellt Feature Spec
2. **User** reviewed Spec und gibt Feedback
3. **Solution Architect** fügt Tech-Design hinzu (Drizzle-Schema + Nitro-Routen + Nuxt-Komponenten)
4. **User** approved finales Design
5. **Frontend/Backend Devs** implementieren (dokumentiert via Git Commits)
6. **QA Engineer** testet und fügt Test-Ergebnisse zum Feature-Dokument hinzu
7. **DevOps** baut das Docker-Image, deployed und fügt den Deployment-Status hinzu

## Status-Tracking

Feature-Status wird direkt im Feature-Dokument getrackt:
```markdown
# FV-1: Authentifizierung & Rollen

**Status:** 🔵 Planned | 🟡 In Progress | ✅ Deployed
**Created:** 2026-08-10
**Last Updated:** 2026-08-10
```

**Status-Bedeutung:**
- 🔵 Planned – Requirements sind geschrieben, ready for development
- 🟡 In Progress – Wird gerade gebaut
- ✅ Deployed – Live im produktiven Container

**Git als Single Source of Truth:**
- Alle Implementierungs-Details sind in Git Commits
- `git log --grep="FV-1"` zeigt alle Änderungen für dieses Feature
- Datenbank-Änderungen sind zusätzlich als Migration in `server/database/migrations/` versioniert
- Keine separate FEATURE_CHANGELOG.md nötig!
