import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { app } from '../src/index'

describe('rate limit and CORS middleware', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns 429 on the 61st request from the same IP in a 60 second window', async () => {
    const headers = { 'x-forwarded-for': '203.0.113.10' }

    for (let requestCount = 0; requestCount < 60; requestCount += 1) {
      const res = await app.request('/me', { headers })

      expect(res.status).toBe(401)
      expect(res.headers.get('content-type')).toContain('application/problem+json')
      const body = await res.json()
      expect(body).toMatchObject({
        type: 'https://lerna.app/problems/unauthorized',
        title: 'Unauthorized',
        status: 401
      })
    }

    const limitedRes = await app.request('/me', { headers })

    expect(limitedRes.status).toBe(429)
    expect(limitedRes.headers.get('content-type')).toContain(
      'application/problem+json'
    )
    const limitedBody = await limitedRes.json()
    expect(limitedBody).toMatchObject({
      type: 'https://lerna.app/problems/too-many-requests',
      title: 'Too Many Requests',
      status: 429
    })

    vi.advanceTimersByTime(60 * 1000)

    const resetRes = await app.request('/me', { headers })

    expect(resetRes.status).toBe(401)
    expect(resetRes.headers.get('content-type')).toContain(
      'application/problem+json'
    )
    const resetBody = await resetRes.json()
    expect(resetBody).toMatchObject({
      type: 'https://lerna.app/problems/unauthorized',
      title: 'Unauthorized',
      status: 401
    })
  })

  it('returns CORS headers for allowed origins and omits them for disallowed origins', async () => {
    const allowedRes = await app.request('/me', {
      method: 'OPTIONS',
      headers: {
        origin: 'http://localhost:5173',
        'access-control-request-method': 'GET',
        'x-forwarded-for': '203.0.113.20'
      }
    })

    expect(allowedRes.status).toBe(200)
    expect(allowedRes.headers.get('Access-Control-Allow-Origin')).toBe(
      'http://localhost:5173'
    )

    vi.advanceTimersByTime(1)

    const disallowedRes = await app.request('/me', {
      method: 'OPTIONS',
      headers: {
        origin: 'http://evil.example.com',
        'access-control-request-method': 'GET',
        'x-forwarded-for': '203.0.113.21'
      }
    })

    expect(disallowedRes.status).toBe(200)
    expect(disallowedRes.headers.get('Access-Control-Allow-Origin')).toBeNull()
  })

  it('does not apply rate limiting to /healthz', async () => {
    const headers = { 'x-forwarded-for': '203.0.113.30' }

    for (let requestCount = 0; requestCount < 100; requestCount += 1) {
      const res = await app.request('/healthz', { headers })

      expect(res.status).toBe(200)
    }

    vi.advanceTimersByTime(60 * 1000)
  })
})
