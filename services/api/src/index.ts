import { serve } from '@hono/node-server'
import { swaggerUI } from '@hono/swagger-ui'
import { env } from './env'
import { authMiddleware } from './middleware/auth'
import { apiCors } from './middleware/cors'
import { ipRateLimit } from './middleware/rate-limit'
import { createOpenApiHono } from './openapi/app'
import { healthzRoute } from './routes/healthz'
import { meRoute } from './routes/me'
import { sessionsRoute } from './routes/sessions'

export const app = createOpenApiHono()

app.use('*', apiCors)
app.use('*', ipRateLimit)

// Public routes
app.route('/healthz', healthzRoute)
app.openAPIRegistry.registerComponent('securitySchemes', 'bearerAuth', {
  type: 'http',
  scheme: 'bearer',
  bearerFormat: 'JWT'
})
app.doc('/openapi.json', {
  openapi: '3.0.0',
  info: {
    title: 'Lerna API',
    version: '0.1.0'
  }
})
app.get('/docs', swaggerUI({ url: '/openapi.json' }))

// Protected routes — auth middleware on both exact and prefix paths
app.use('/me', authMiddleware)
app.use('/me/*', authMiddleware)
app.use('/sessions', authMiddleware)
app.use('/sessions/*', authMiddleware)
app.route('/me', meRoute)
app.route('/sessions', sessionsRoute)

if (env.NODE_ENV !== 'test') {
  serve(
    {
      fetch: app.fetch,
      port: env.PORT
    },
    (info) => {
      console.log(`API listening on http://localhost:${info.port}`)
    }
  )
}
