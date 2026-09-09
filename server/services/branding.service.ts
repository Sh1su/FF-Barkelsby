import { eq } from 'drizzle-orm'
import { brandingSettings } from '../database/schema'

/**
 * Erscheinungsbild der Wehr (Name, Kurzname, Logo) – ueber die Verwaltung editierbar.
 * Genau eine Zeile in `branding_settings` (`id = 'default'`); ohne sie gelten die Werte aus
 * `runtimeConfig.public.organisation` und das mitgelieferte `public/logo.png`.
 */

const SETTINGS_ID = 'default'

export interface Branding {
  name: string
  shortName: string
  logoUrl: string
}

const MAX_LOGO_BYTES = 2 * 1024 * 1024
const ALLOWED_LOGO_MIMES = ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp']

function row() {
  return useDatabase().select().from(brandingSettings).where(eq(brandingSettings.id, SETTINGS_ID)).get()
}

function fallback() {
  return useRuntimeConfig().public.organisation
}

export function getBranding(): Branding {
  const existing = row()
  const defaults = fallback()

  return {
    name: existing?.name ?? defaults.name,
    shortName: existing?.shortName ?? defaults.shortName,
    logoUrl: existing?.logoData && existing.logoMime
      ? `data:${existing.logoMime};base64,${existing.logoData}`
      : '/logo.png',
  }
}

export function saveBrandingText(input: { name: string, shortName: string }): Branding {
  const db = useDatabase()
  const existing = row()

  if (existing) {
    db.update(brandingSettings)
      .set({ name: input.name, shortName: input.shortName, updatedAt: new Date() })
      .where(eq(brandingSettings.id, SETTINGS_ID))
      .run()
  }
  else {
    db.insert(brandingSettings)
      .values({ id: SETTINGS_ID, name: input.name, shortName: input.shortName })
      .run()
  }

  return getBranding()
}

export function saveBrandingLogo(data: Buffer, mime: string): Branding {
  if (!ALLOWED_LOGO_MIMES.includes(mime)) {
    throw createError({ statusCode: 400, statusMessage: 'Nur PNG, JPEG, WebP oder SVG als Logo.' })
  }
  if (data.byteLength > MAX_LOGO_BYTES) {
    throw createError({ statusCode: 400, statusMessage: 'Das Logo darf höchstens 2 MB groß sein.' })
  }

  const db = useDatabase()
  const existing = row()
  const logoData = data.toString('base64')

  if (existing) {
    db.update(brandingSettings)
      .set({ logoData, logoMime: mime, updatedAt: new Date() })
      .where(eq(brandingSettings.id, SETTINGS_ID))
      .run()
  }
  else {
    const defaults = fallback()
    db.insert(brandingSettings)
      .values({ id: SETTINGS_ID, name: defaults.name, shortName: defaults.shortName, logoData, logoMime: mime })
      .run()
  }

  return getBranding()
}
