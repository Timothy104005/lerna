import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { sign } from 'hono/jwt'
import { app } from '../src/index'
import { resetSessionsRepo } from '../src/repositories/in-memory-sessions-repo'
import { SessionSchema } from '../src/types/session'
import { TEST_JWT_SECRET } from './setup'

function userId(n: number): string {
  return `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
}

async function authHeaders(userIdValue: string, ip: string): Promise<HeadersInit> {
  const token = await sign(
    {
      sub: userIdValue,
      role: 'authenticated',
      aud: 'authenticated',
      exp: Math.floor(Date.now() / 1000) + 60 * 60
    },
    TEST_JWT_SECRET,
    'HS256'
  )

  return {
    authorization: `Bearer ${token}`,
    'content-type': 'application/json',
    'x-forwarded-for': ip
  }
}

async function createSession(input: {
  userIdValue: string
  ip: string
  body?: Record<string, unknown>
}) {
  return app.request('/sessions', {
    method: 'POST',
    headers: await authHeaders(input.userIdValue, input.ip),
    body: JSON.stringify(
      input.body ?? {
        startedAt: '2026-01-01T00:00:00.000Z',
        subject: 'Math',
        tags: ['algebra'],
        notes: 'Practice session'
      }
    )
  })
}

describe('sessions routes', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'))
    resetSessionsRepo()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('POST /sessions creates a session for the authenticated user', async () => {
    const user = userId(1)

    const response = await createSession({
      userIdValue: user,
      ip: '203.0.113.100'
    })

    expect(response.status).toBe(201)

    const body = await response.json()

    expect(() => SessionSchema.parse(body)).not.toThrow()
    expect(body).toMatchObject({
      userId: user,
      startedAt: '2026-01-01T00:00:00.000Z',
      endedAt: null,
      durationSec: 0,
      subject: 'Math',
      tags: ['algebra'],
      notes: 'Practice session',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z'
    })
    expect(typeof body.id).toBe('string')
  })

  it('POST /sessions returns 400 for invalid body', async () => {
    const response = await createSession({
      userIdValue: userId(2),
      ip: '203.0.113.101',
      body: {
        subject: 'x'.repeat(121)
      }
    })

    expect(response.status).toBe(400)

    const body = await response.json()

    expect(body.error).toBe('Invalid request')
    expect(body.details.fieldErrors.subject).toBeDefined()
  })

  it('GET /sessions only lists sessions owned by the authenticated user', async () => {
    const userA = userId(3)
    const userB = userId(4)

    const createA = await createSession({
      userIdValue: userA,
      ip: '203.0.113.102',
      body: {
        subject: 'Physics',
        tags: ['mechanics']
      }
    })
    const createB = await createSession({
      userIdValue: userB,
      ip: '203.0.113.102',
      body: {
        subject: 'Biology',
        tags: ['cells']
      }
    })

    expect(createA.status).toBe(201)
    expect(createB.status).toBe(201)

    const response = await app.request('/sessions', {
      method: 'GET',
      headers: await authHeaders(userA, '203.0.113.102')
    })

    expect(response.status).toBe(200)

    const body = await response.json()

    expect(body).toHaveLength(1)
    expect(body[0].userId).toBe(userA)
    expect(body[0].subject).toBe('Physics')
  })

  it('PATCH /sessions/:id updates an owned session', async () => {
    const user = userId(5)

    const createResponse = await createSession({
      userIdValue: user,
      ip: '203.0.113.103'
    })
    const created = await createResponse.json()

    vi.setSystemTime(new Date('2026-01-01T01:00:00.000Z'))

    const response = await app.request(`/sessions/${created.id}`, {
      method: 'PATCH',
      headers: await authHeaders(user, '203.0.113.103'),
      body: JSON.stringify({
        endedAt: '2026-01-01T01:00:00.000Z',
        durationSec: 3600,
        subject: 'Updated Math',
        tags: ['algebra', 'review'],
        notes: 'Finished review'
      })
    })

    expect(response.status).toBe(200)

    const body = await response.json()

    expect(body).toMatchObject({
      id: created.id,
      userId: user,
      endedAt: '2026-01-01T01:00:00.000Z',
      durationSec: 3600,
      subject: 'Updated Math',
      tags: ['algebra', 'review'],
      notes: 'Finished review',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T01:00:00.000Z'
    })
  })

  it('PATCH /sessions/:id returns 404 when updating another user session', async () => {
    const owner = userId(6)
    const attacker = userId(7)

    const createResponse = await createSession({
      userIdValue: owner,
      ip: '203.0.113.104'
    })
    const created = await createResponse.json()

    const response = await app.request(`/sessions/${created.id}`, {
      method: 'PATCH',
      headers: await authHeaders(attacker, '203.0.113.104'),
      body: JSON.stringify({
        subject: 'Should not update'
      })
    })

    expect(response.status).toBe(404)

    const body = await response.json()

    expect(body).toEqual({ error: 'Not found' })
  })

  it('DELETE /sessions/:id deletes an owned session', async () => {
    const user = userId(8)

    const createResponse = await createSession({
      userIdValue: user,
      ip: '203.0.113.105'
    })
    const created = await createResponse.json()

    const deleteResponse = await app.request(`/sessions/${created.id}`, {
      method: 'DELETE',
      headers: await authHeaders(user, '203.0.113.105')
    })

    expect(deleteResponse.status).toBe(204)
    expect(await deleteResponse.text()).toBe('')

    const listResponse = await app.request('/sessions', {
      method: 'GET',
      headers: await authHeaders(user, '203.0.113.105')
    })
    const listBody = await listResponse.json()

    expect(listBody).toEqual([])
  })

  it('DELETE /sessions/:id returns 404 when deleting another user session', async () => {
    const owner = userId(9)
    const attacker = userId(10)

    const createResponse = await createSession({
      userIdValue: owner,
      ip: '203.0.113.106'
    })
    const created = await createResponse.json()

    const deleteResponse = await app.request(`/sessions/${created.id}`, {
      method: 'DELETE',
      headers: await authHeaders(attacker, '203.0.113.106')
    })

    expect(deleteResponse.status).toBe(404)

    const deleteBody = await deleteResponse.json()

    expect(deleteBody).toEqual({ error: 'Not found' })

    const listResponse = await app.request('/sessions', {
      method: 'GET',
      headers: await authHeaders(owner, '203.0.113.106')
    })
    const listBody = await listResponse.json()

    expect(listBody).toHaveLength(1)
    expect(listBody[0].id).toBe(created.id)
  })
})
