import { createRoute } from '@hono/zod-openapi'
import { createOpenApiHono } from '../openapi/app'
import { HealthzResponseSchema } from '../openapi/schemas'

const getHealthzRoute = createRoute({
  method: 'get',
  path: '/',
  responses: {
    200: {
      description: 'API health check',
      content: {
        'application/json': {
          schema: HealthzResponseSchema
        }
      }
    }
  }
})

export const healthzRoute = createOpenApiHono()

healthzRoute.openapi(getHealthzRoute, (c) => {
  return c.json({
    ok: true,
    version: process.env.npm_package_version ?? '0.0.0'
  }, 200)
})
