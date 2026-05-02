import { createRequire } from 'node:module'

import { env } from '../env'
import { inMemorySessionsRepo, resetSessionsRepo } from './in-memory-sessions-repo'
import type { SessionsRepo } from './sessions-repo'

const require = createRequire(import.meta.url)

let cached: SessionsRepo | undefined

export function getSessionsRepo(): SessionsRepo {
  if (cached) return cached

  if (env.SESSIONS_REPO === 'drizzle') {
    // Lazy load，避免 default in-memory mode 在 test/dev 期間載入 Postgres client。
    const { db } = require('../db/client') as typeof import('../db/client')
    const { DrizzleSessionsRepo } = require('./drizzle-sessions-repo') as typeof import('./drizzle-sessions-repo')
    cached = new DrizzleSessionsRepo(db)
  } else {
    cached = inMemorySessionsRepo
  }

  return cached
}

export const sessionsRepo = new Proxy({} as SessionsRepo, {
  get(_, prop) {
    const repo = getSessionsRepo()
    const value = Reflect.get(repo, prop)

    return typeof value === 'function' ? value.bind(repo) : value
  }
})

export { resetSessionsRepo }
