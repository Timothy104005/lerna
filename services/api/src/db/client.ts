import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { env } from '../env'
import * as schema from './schema'

export const queryClient = postgres(env.DATABASE_URL, {
  max: 1
})

export const db = drizzle(queryClient, {
  schema
})

export type DbClient = typeof db
