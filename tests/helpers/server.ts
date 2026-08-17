import { fileURLToPath } from 'node:url'
import { setup } from '@nuxt/test-utils/e2e'

/**
 * Startet einen Nitro-Server mit eigener Datenbank fuer genau diese Testdatei.
 *
 * `.claude/rules/testing.md` verlangt eine frische Datenbank je Testdatei – ohne die
 * Trennung wuerden sich die Dateien ueber geaenderte Seed-Passwoerter gegenseitig
 * beeinflussen, je nach Ausfuehrungsreihenfolge.
 */
export function startTestServer(name: string, env: Record<string, string> = {}) {
  return setup({
    rootDir: fileURLToPath(new URL('../..', import.meta.url)),
    dev: true,
    env: {
      NUXT_DB_PATH: `./tests/.tmp/${name}.db`,
      // Mailversand ist im Test grundsaetzlich aus: der Dev-Server liest sonst die echte
      // .env und wuerde ueber das produktive Relay wirklich Mails verschicken
      // (.claude/rules/testing.md: kein Netzwerkzugriff in Tests).
      NUXT_SMTP_HOST: '',
      NUXT_SMTP_USER: '',
      NUXT_SMTP_PASSWORD: '',
      NUXT_SMTP_FROM: '',
      ...env,
    },
  })
}
