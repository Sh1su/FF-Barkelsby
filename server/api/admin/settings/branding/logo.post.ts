import { saveBrandingLogo } from '../../../../services/branding.service'

/** Logo hochladen (Verwaltung, Einstellungen) – multipart/form-data mit einem Feld `logo`. */
export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const parts = await readMultipartFormData(event)
  const logo = parts?.find(part => part.name === 'logo')

  if (!logo?.data?.length || !logo.type) {
    throw createError({ statusCode: 400, statusMessage: 'Bitte eine Bilddatei auswählen.' })
  }

  return saveBrandingLogo(logo.data, logo.type)
})
