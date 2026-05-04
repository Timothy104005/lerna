import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { config } from 'dotenv'
import { z } from 'zod'

const apiRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')

config({
  path: resolve(apiRoot, '.env'),
  quiet: true
})

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  PORT: z.coerce.number().int().positive().default(8787),

  SESSIONS_REPO: z.enum(['in-memory', 'drizzle']).default('in-memory'),

  CORS_ORIGINS: z.string().default('http://localhost:5173'),

  DATABASE_URL: z.string().url(),

  SUPABASE_URL: z.string().url(),

  SUPABASE_ANON_KEY: z.string().min(1),

  SUPABASE_JWT_SECRET: z.string().min(1)
})

export const env = envSchema.parse(process.env)

export type ApiEnv = z.infer<typeof envSchema>
