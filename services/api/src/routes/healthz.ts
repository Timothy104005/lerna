import { Hono } from 'hono'

export const healthzRoute = new Hono().get('/', (c) => {
  return c.json({
    ok: true,
    version: process.env.npm_package_version ?? '0.0.0'
  })
})
