import type { MiddlewareHandler } from 'hono'

declare module 'hono' {
  interface ContextVariableMap {
    requestId: string
  }
}

const REQUEST_ID_HEADER = 'X-Request-Id'
const ID_REGEX = /^[A-Za-z0-9_-]{1,128}$/

export const requestIdMiddleware: MiddlewareHandler = async (c, next) => {
  const incoming = c.req.header(REQUEST_ID_HEADER)
  const requestId = incoming && ID_REGEX.test(incoming) ? incoming : crypto.randomUUID()

  c.set('requestId', requestId)
  c.header(REQUEST_ID_HEADER, requestId)

  await next()
}
