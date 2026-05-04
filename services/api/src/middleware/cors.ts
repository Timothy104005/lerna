import type { MiddlewareHandler } from 'hono'
import { env } from '../env'

const TEST_CORS_ORIGINS = ['http://localhost:5173']
const ALLOW_HEADERS = 'Authorization,Content-Type'
const ALLOW_METHODS = 'GET,POST,PUT,PATCH,DELETE,OPTIONS'

function parseCorsOrigins(corsOrigins: string) {
  return corsOrigins
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
}

const allowedOrigins =
  env.NODE_ENV === 'test' ? TEST_CORS_ORIGINS : parseCorsOrigins(env.CORS_ORIGINS)

export const apiCors: MiddlewareHandler = async (c, next) => {
  const origin = c.req.header('origin')
  const allowedOrigin =
    origin && allowedOrigins.includes(origin) ? origin : undefined

  if (allowedOrigin) {
    c.header('Access-Control-Allow-Origin', allowedOrigin)
    c.header('Access-Control-Allow-Credentials', 'true')
    c.header('Vary', 'Origin', { append: true })
  }

  if (c.req.method === 'OPTIONS') {
    c.header('Access-Control-Allow-Headers', ALLOW_HEADERS)
    c.header('Access-Control-Allow-Methods', ALLOW_METHODS)

    return c.body(null, 200)
  }

  return next()
}
