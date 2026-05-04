import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { config } from 'dotenv'
import { defineConfig } from 'drizzle-kit'

config({
  path: resolve(dirname(fileURLToPath(import.meta.url)), '.env'),
  quiet: true
})

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? ''
  },
  verbose: true,
  strict: true
})
