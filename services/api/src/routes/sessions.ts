import { createRoute } from '@hono/zod-openapi'
import type { Context, MiddlewareHandler } from 'hono'
import {
  invalidJsonBody,
  notFound,
  validationFailed
} from '../lib/problem'
import type { AuthEnv } from '../middleware/auth'
import { createOpenApiHono } from '../openapi/app'
import {
  CreateSessionRequestSchema,
  NotFoundResponseSchema,
  RateLimitResponseSchema,
  SessionIdParamSchema,
  SessionResponseSchema,
  SessionsResponseSchema,
  UnauthorizedResponseSchema,
  UpdateSessionRequestSchema,
  ValidationErrorResponseSchema
} from '../openapi/schemas'
import { sessionsRepo } from '../repositories'
import { NewSessionSchema, UpdateSessionSchema } from '../types/session'

type JsonBodyResult =
  | { ok: true; body: unknown }
  | {
      ok: false
      response: ReturnType<typeof invalidJsonBody>
    }

async function readJsonBody(c: Context<AuthEnv>): Promise<JsonBodyResult> {
  try {
    return {
      ok: true,
      body: await c.req.json()
    }
  } catch {
    return {
      ok: false,
      response: invalidJsonBody(c)
    }
  }
}

const jsonBodyGuard: MiddlewareHandler<AuthEnv> = async (c, next) => {
  const jsonBody = await readJsonBody(c)

  if (!jsonBody.ok) {
    return jsonBody.response as unknown as Response
  }

  return next()
}

const createSessionRoute = createRoute({
  method: 'post',
  path: '/',
  security: [{ bearerAuth: [] }],
  middleware: [jsonBodyGuard],
  request: {
    body: {
      required: true,
      content: {
        'application/json': {
          schema: CreateSessionRequestSchema
        }
      }
    }
  },
  responses: {
    201: {
      description: 'Session created',
      content: {
        'application/json': {
          schema: SessionResponseSchema
        }
      }
    },
    400: {
      description: 'Invalid request body',
      content: {
        'application/problem+json': {
          schema: ValidationErrorResponseSchema
        }
      }
    },
    401: {
      description: 'Missing or invalid bearer token',
      content: {
        'application/problem+json': {
          schema: UnauthorizedResponseSchema
        }
      }
    },
    429: {
      description: 'Rate limit exceeded',
      content: {
        'application/problem+json': {
          schema: RateLimitResponseSchema
        }
      }
    }
  }
})

const listSessionsRoute = createRoute({
  method: 'get',
  path: '/',
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      description: 'Sessions owned by the authenticated user',
      content: {
        'application/json': {
          schema: SessionsResponseSchema
        }
      }
    },
    401: {
      description: 'Missing or invalid bearer token',
      content: {
        'application/problem+json': {
          schema: UnauthorizedResponseSchema
        }
      }
    },
    429: {
      description: 'Rate limit exceeded',
      content: {
        'application/problem+json': {
          schema: RateLimitResponseSchema
        }
      }
    }
  }
})

const updateSessionRoute = createRoute({
  method: 'patch',
  path: '/{id}',
  security: [{ bearerAuth: [] }],
  middleware: [jsonBodyGuard],
  request: {
    params: SessionIdParamSchema,
    body: {
      required: true,
      content: {
        'application/json': {
          schema: UpdateSessionRequestSchema
        }
      }
    }
  },
  responses: {
    200: {
      description: 'Session updated',
      content: {
        'application/json': {
          schema: SessionResponseSchema
        }
      }
    },
    400: {
      description: 'Invalid request body',
      content: {
        'application/problem+json': {
          schema: ValidationErrorResponseSchema
        }
      }
    },
    401: {
      description: 'Missing or invalid bearer token',
      content: {
        'application/problem+json': {
          schema: UnauthorizedResponseSchema
        }
      }
    },
    404: {
      description: 'Session not found',
      content: {
        'application/problem+json': {
          schema: NotFoundResponseSchema
        }
      }
    },
    429: {
      description: 'Rate limit exceeded',
      content: {
        'application/problem+json': {
          schema: RateLimitResponseSchema
        }
      }
    }
  }
})

const deleteSessionRoute = createRoute({
  method: 'delete',
  path: '/{id}',
  security: [{ bearerAuth: [] }],
  request: {
    params: SessionIdParamSchema
  },
  responses: {
    204: {
      description: 'Session deleted'
    },
    401: {
      description: 'Missing or invalid bearer token',
      content: {
        'application/problem+json': {
          schema: UnauthorizedResponseSchema
        }
      }
    },
    404: {
      description: 'Session not found',
      content: {
        'application/problem+json': {
          schema: NotFoundResponseSchema
        }
      }
    },
    429: {
      description: 'Rate limit exceeded',
      content: {
        'application/problem+json': {
          schema: RateLimitResponseSchema
        }
      }
    }
  }
})

export const sessionsRoute = createOpenApiHono()

sessionsRoute.openapi(createSessionRoute, async (c) => {
  const jsonBody = await readJsonBody(c)

  if (!jsonBody.ok) {
    return jsonBody.response
  }

  const parsed = NewSessionSchema.safeParse(jsonBody.body)

  if (!parsed.success) {
    return validationFailed(c, parsed.error)
  }

  const user = c.get('user')
  const session = await sessionsRepo.create(user.sub, parsed.data)

  return c.json(session, 201)
})

sessionsRoute.openapi(listSessionsRoute, async (c) => {
  const user = c.get('user')
  const sessions = await sessionsRepo.list(user.sub)

  return c.json(sessions, 200)
})

sessionsRoute.openapi(updateSessionRoute, async (c) => {
  const jsonBody = await readJsonBody(c)

  if (!jsonBody.ok) {
    return jsonBody.response
  }

  const parsed = UpdateSessionSchema.safeParse(jsonBody.body)

  if (!parsed.success) {
    return validationFailed(c, parsed.error)
  }

  const user = c.get('user')
  const updated = await sessionsRepo.update(user.sub, c.req.param('id'), parsed.data)

  if (!updated) {
    return notFound(c)
  }

  return c.json(updated, 200)
})

sessionsRoute.openapi(deleteSessionRoute, async (c) => {
  const user = c.get('user')
  const deleted = await sessionsRepo.delete(user.sub, c.req.param('id'))

  if (!deleted) {
    return notFound(c)
  }

  return c.body(null, 204)
})
