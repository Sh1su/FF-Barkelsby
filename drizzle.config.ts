import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  dialect: 'sqlite',
  schema: './server/database/schema.ts',
  out: './server/assets/migrations',
  dbCredentials: {
    url: process.env.NUXT_DB_PATH || './data/app.db',
  },
  strict: true,
  verbose: true,
})
