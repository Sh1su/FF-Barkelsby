import type { H3Event } from 'h3'
import { LOGIN_RATE_LIMIT } from '../../shared/constants'

interface Bucket {
  attempts: number[]
}

const buckets = new Map<string, Bucket>()

/**
 * Rate Limit pro IP fuer die Anmeldung (FV-1, AC-5/AC-6).
 *
 * Bewusst pro IP und niemals pro Konto: das Gast-Konto ist geteilt, ein Konto-Lockout
 * wuerde die gesamte Wehr aussperren. In-Memory ist ausreichend, weil die Anwendung
 * als Einzelinstanz laeuft (PRD, Constraints).
 */
export interface RateLimit {
  readonly maxAttempts: number
  readonly windowMs: number
}

export function checkRateLimit(
  key: string,
  now: number = Date.now(),
  limit: RateLimit = LOGIN_RATE_LIMIT,
): { allowed: boolean, remaining: number, retryAfterSeconds: number } {
  const bucket = buckets.get(key) ?? { attempts: [] }
  const windowStart = now - limit.windowMs
  bucket.attempts = bucket.attempts.filter(timestamp => timestamp > windowStart)

  if (bucket.attempts.length >= limit.maxAttempts) {
    const oldest = bucket.attempts[0]!
    buckets.set(key, bucket)
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.ceil((oldest + limit.windowMs - now) / 1000),
    }
  }

  buckets.set(key, bucket)
  return {
    allowed: true,
    remaining: limit.maxAttempts - bucket.attempts.length,
    retryAfterSeconds: 0,
  }
}

/** Zaehlt einen Fehlversuch. Erfolgreiche Anmeldungen rufen stattdessen `resetRateLimit`. */
export function recordFailure(key: string, now: number = Date.now()): void {
  const bucket = buckets.get(key) ?? { attempts: [] }
  bucket.attempts.push(now)
  buckets.set(key, bucket)
}

export function resetRateLimit(key: string): void {
  buckets.delete(key)
}

/** Nur fuer Tests. */
export function _clearRateLimits(): void {
  buckets.clear()
}

/** Client-IP hinter dem Reverse Proxy. Faellt auf die Socket-Adresse zurueck. */
export function clientIp(event: H3Event): string {
  return getRequestIP(event, { xForwardedFor: true }) ?? 'unbekannt'
}
