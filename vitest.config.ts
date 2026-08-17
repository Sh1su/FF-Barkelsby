import { defineConfig } from 'vitest/config'
import { defineVitestProject } from '@nuxt/test-utils/config'

/**
 * Drei Projekte mit unterschiedlicher Umgebung:
 * - unit:       reine Fachlogik, kein Nuxt, kein HTTP
 * - api:        echte Routen gegen einen gestarteten Nitro-Server (@nuxt/test-utils/e2e)
 * - components: Vue-Komponenten in der Nuxt-Umgebung
 */
export default defineConfig({
  test: {
    globals: true,
    globalSetup: ['./tests/global-setup.ts'],
    projects: [
      {
        test: {
          name: 'unit',
          include: ['tests/unit/**/*.spec.ts'],
          environment: 'node',
          setupFiles: ['./tests/setup-env.ts'],
        },
      },
      {
        test: {
          name: 'api',
          include: ['tests/api/**/*.spec.ts'],
          environment: 'node',
          setupFiles: ['./tests/setup-env.ts'],
          testTimeout: 60_000,
          hookTimeout: 300_000,
          // Jede Datei startet einen eigenen Nitro-Server auf derselben Testdatenbank –
          // parallel wuerden sie sich beim Migrieren und Seeden in die Quere kommen.
          fileParallelism: false,
        },
      },
      await defineVitestProject({
        test: {
          name: 'components',
          include: ['tests/components/**/*.spec.ts'],
          environment: 'nuxt',
          setupFiles: ['./tests/setup-env.ts'],
        },
      }),
    ],
    coverage: {
      provider: 'v8',
      include: ['server/**/*.ts', 'shared/**/*.ts'],
      exclude: ['server/database/migrations/**'],
    },
  },
})
