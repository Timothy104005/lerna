import { rateLimiter } from 'hono-rate-limiter'
import { tooManyRequests } from '../lib/problem'
import type { AuthEnv } from './auth'

export const ipRateLimit = rateLimiter<AuthEnv>({
  windowMs: 60 * 1000,
  limit: 60,
  keyGenerator: (c) => c.req.header('x-forwarded-for') ?? 'unknown',
  skip: (c) => c.req.path === '/healthz',
  handler: (c) => tooManyRequests(c)
})
