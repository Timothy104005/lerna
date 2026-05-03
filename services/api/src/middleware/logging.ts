import type { MiddlewareHandler } from 'hono'
import { logger } from '../lib/logger'

const SILENT_PATHS = new Set(['/healthz', '/openapi.json', '/docs'])

export const loggingMiddleware: MiddlewareHandler = async (c, next) => {
  const start = Date.now()
  const path = new URL(c.req.url).pathname

  try {
    await next()
  } finally {
    if (!SILENT_PATHS.has(path)) {
      const userSub = (c.get('user') as { sub?: string } | undefined)?.sub

      logger.info(
        {
          requestId: c.get('requestId'),
          method: c.req.method,
          path,
          status: c.res?.status ?? 500,
          durationMs: Date.now() - start,
          userSub
        },
        'request'
      )
    }
  }
}
