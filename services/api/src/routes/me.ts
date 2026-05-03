import { createRoute } from '@hono/zod-openapi'
import { createOpenApiHono } from '../openapi/app'
import {
  MeResponseSchema,
  RateLimitResponseSchema,
  UnauthorizedResponseSchema
} from '../openapi/schemas'

const getMeRoute = createRoute({
  method: 'get',
  path: '/',
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      description: 'Authenticated user profile',
      content: {
        'application/json': {
          schema: MeResponseSchema
        }
      }
    },
    401: {
      description: 'Missing or invalid bearer token',
      content: {
        'application/json': {
          schema: UnauthorizedResponseSchema
        }
      }
    },
    429: {
      description: 'Rate limit exceeded',
      content: {
        'application/json': {
          schema: RateLimitResponseSchema
        }
      }
    }
  }
})

export const meRoute = createOpenApiHono()

meRoute.openapi(getMeRoute, (c) => {
  const user = c.get('user')

  return c.json({
    id: user.sub,
    email: typeof user.email === 'string' ? user.email : null
  }, 200)
})
