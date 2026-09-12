import { getMatrix } from '../../services/matrix.service'

/** Admin-Matrix: Mitglieder x Lehrgaenge mit Abschluss-Status (FV-19, AC-1). */
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  return getMatrix()
})
