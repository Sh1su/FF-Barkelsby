import type { H3Event } from 'h3'

/**
 * Entfernt den Sitzungs-Cookie aus der eingehenden Anfrage.
 *
 * `clearUserSession()` setzt nur einen leeren Cookie in die Antwort und wirft den
 * zwischengespeicherten Zustand weg. Wer danach im selben Request die Sitzung erneut liest –
 * der Endpunkt `/api/_auth/session` tut genau das –, bekommt von h3 den unveraenderten
 * Cookie aus der Anfrage neu entsiegelt, und die eben verworfene Sitzung ist wieder da
 * (h3 1.15, `clearSession`). Danach meldete die Oberflaeche ein deaktiviertes oder
 * abgemeldetes Konto weiter als angemeldet (QA-Befund BUG-7-3).
 */
export function forgetRequestSessionCookie(event: H3Event): void {
  const roh = getRequestHeader(event, 'cookie')
  if (!roh) return

  const name = (useRuntimeConfig(event).session as { name?: string } | undefined)?.name ?? 'h3'

  const uebrig = roh
    .split(';')
    .map(eintrag => eintrag.trim())
    .filter(eintrag => eintrag.length > 0 && !eintrag.startsWith(`${name}=`))
    .join('; ')

  event.node.req.headers.cookie = uebrig.length > 0 ? uebrig : undefined
}
