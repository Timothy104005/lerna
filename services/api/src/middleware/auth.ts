import type { MiddlewareHandler } from 'hono'
import { verify } from 'hono/jwt'
import { env } from '../env'
import { unauthorized } from '../lib/problem'

export type AuthUser = {
  sub: string
  email?: string
  role?: string
  aud?: string | string[]
  exp?: number
  iat?: number
  iss?: string
  [claim: string]: unknown
}

export type AuthVariables = {
  user: AuthUser
}

export type AuthEnv = {
  Variables: AuthVariables
}

function extractBearerToken(authorizationHeader: string | undefined): string | null {
  if (!authorizationHeader) {
    return null
  }

  const [scheme, token] = authorizationHeader.split(' ')

  if (scheme !== 'Bearer' || !token) {
    return null
  }

  return token
}

export const authMiddleware: MiddlewareHandler<AuthEnv> = async (c, next) => {
  const token = extractBearerToken(c.req.header('Authorization'))

  if (!token) {
    return unauthorized(c)
  }

  try {
    const payload = await verify(token, env.SUPABASE_JWT_SECRET, 'HS256')
    const user = payload as AuthUser

    if (!user.sub || typeof user.sub !== 'string') {
      return unauthorized(c)
    }

    const now = Math.floor(Date.now() / 1000)

    if (typeof user.exp === 'number' && user.exp <= now) {
      return unauthorized(c)
    }

    c.set('user', user)

    return next()
  } catch {
    return unauthorized(c)
  }
}
