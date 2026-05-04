import { sign } from 'hono/jwt'
import { describe, expect, it } from 'vitest'
import { app } from '../src/index'
import { TEST_JWT_SECRET } from './setup'

describe('api routes', () => {
  it('GET /healthz returns 200', async () => {
    const res = await app.request('/healthz')
    const body = (await res.json()) as { ok: boolean; version: string }

    expect(res.status).toBe(200)
    expect(body).toMatchObject({ ok: true })
    expect(typeof body.version).toBe('string')
  })

  it('GET /me without token returns 401', async () => {
    const res = await app.request('/me')

    expect(res.status).toBe(401)
    expect(res.headers.get('content-type')).toContain('application/problem+json')
    const body = await res.json()
    expect(body).toMatchObject({
      type: 'https://lerna.app/problems/unauthorized',
      title: 'Unauthorized',
      status: 401
    })
  })

  it('GET /me with invalid token returns 401', async () => {
    const res = await app.request('/me', {
      headers: { Authorization: 'Bearer invalid.jwt.token' }
    })

    expect(res.status).toBe(401)
    expect(res.headers.get('content-type')).toContain('application/problem+json')
    const body = await res.json()
    expect(body).toMatchObject({
      type: 'https://lerna.app/problems/unauthorized',
      title: 'Unauthorized',
      status: 401
    })
  })

  it('GET /me with valid token returns 200', async () => {
    const userId = '00000000-0000-0000-0000-000000000001'
    const email = 'test@example.com'
    const now = Math.floor(Date.now() / 1000)

    const token = await sign(
      {
        sub: userId,
        email,
        role: 'authenticated',
        aud: 'authenticated',
        iat: now,
        exp: now + 60 * 60
      },
      TEST_JWT_SECRET,
      'HS256'
    )

    const res = await app.request('/me', {
      headers: { Authorization: `Bearer ${token}` }
    })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toEqual({ id: userId, email })
  })
})
