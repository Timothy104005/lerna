import { Hono } from 'hono'
import type { AuthEnv } from '../middleware/auth'

export const meRoute = new Hono<AuthEnv>().get('/', (c) => {
  const user = c.get('user')

  return c.json({
    id: user.sub,
    email: typeof user.email === 'string' ? user.email : null
  })
})
