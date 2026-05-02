import { Hono } from 'hono'
import type { Context } from 'hono'
import { inMemorySessionsRepo } from '../repositories/in-memory-sessions-repo'
import { NewSessionSchema, UpdateSessionSchema } from '../types/session'
import type { AuthEnv } from '../middleware/auth'

type JsonBodyResult =
  | { ok: true; body: unknown }
  | {
      ok: false
      response: Response
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
      response: c.json(
        {
          error: 'Invalid request',
          details: {
            formErrors: ['Invalid JSON body'],
            fieldErrors: {}
          }
        },
        400
      )
    }
  }
}

export const sessionsRoute = new Hono<AuthEnv>()

sessionsRoute.post('/', async (c) => {
  const jsonBody = await readJsonBody(c)

  if (!jsonBody.ok) {
    return jsonBody.response
  }

  const parsed = NewSessionSchema.safeParse(jsonBody.body)

  if (!parsed.success) {
    return c.json(
      {
        error: 'Invalid request',
        details: parsed.error.flatten()
      },
      400
    )
  }

  const user = c.get('user')
  const session = await inMemorySessionsRepo.create(user.sub, parsed.data)

  return c.json(session, 201)
})

sessionsRoute.get('/', async (c) => {
  const user = c.get('user')
  const sessions = await inMemorySessionsRepo.list(user.sub)

  return c.json(sessions, 200)
})

sessionsRoute.patch('/:id', async (c) => {
  const jsonBody = await readJsonBody(c)

  if (!jsonBody.ok) {
    return jsonBody.response
  }

  const parsed = UpdateSessionSchema.safeParse(jsonBody.body)

  if (!parsed.success) {
    return c.json(
      {
        error: 'Invalid request',
        details: parsed.error.flatten()
      },
      400
    )
  }

  const user = c.get('user')
  const updated = await inMemorySessionsRepo.update(user.sub, c.req.param('id'), parsed.data)

  if (!updated) {
    return c.json({ error: 'Not found' }, 404)
  }

  return c.json(updated, 200)
})

sessionsRoute.delete('/:id', async (c) => {
  const user = c.get('user')
  const deleted = await inMemorySessionsRepo.delete(user.sub, c.req.param('id'))

  if (!deleted) {
    return c.json({ error: 'Not found' }, 404)
  }

  return c.body(null, 204)
})
