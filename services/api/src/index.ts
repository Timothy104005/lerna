import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { env } from './env'
import { authMiddleware, type AuthEnv } from './middleware/auth'
import { apiCors } from './middleware/cors'
import { ipRateLimit } from './middleware/rate-limit'
import { healthzRoute } from './routes/healthz'
import { meRoute } from './routes/me'

export const app = new Hono<AuthEnv>()

app.use('*', apiCors)
app.use('*', ipRateLimit)

// Public routes
app.route('/healthz', healthzRoute)

// Protected routes — auth middleware on both exact and prefix paths
app.use('/me', authMiddleware)
app.use('/me/*', authMiddleware)
app.route('/me', meRoute)

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
