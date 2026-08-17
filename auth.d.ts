import type { UserRole } from './shared/constants'

declare module '#auth-utils' {
  interface User {
    id: string
    email: string
    role: UserRole
    displayName: string
    mustChangePassword: boolean
  }

  interface UserSession {
    /** Kennung dieser Session – Grundlage der Sperrliste beim Abmelden. */
    sid: string
    /** Rollenabhaengiges Ablaufdatum (Gast 30 Tage, Admin 8 Stunden). */
    expiresAt: number
    loggedInAt: number
  }

}

export {}
