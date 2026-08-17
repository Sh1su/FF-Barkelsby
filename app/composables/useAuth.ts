/** Abmelden und Session neu laden (FV-1, AC-12). */
export function useAuth() {
  const { fetch: refreshSession, clear } = useUserSession()

  async function logout() {
    try {
      await $fetch('/api/auth/logout', { method: 'POST' })
    }
    finally {
      await clear()
      await refreshSession()
      await navigateTo('/login')
    }
  }

  return { logout }
}
