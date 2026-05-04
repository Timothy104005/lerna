import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('drizzle-orm', () => ({
  and: vi.fn((...conditions: unknown[]) => ({ op: 'and', conditions })),
  desc: vi.fn((column: unknown) => ({ op: 'desc', column })),
  eq: vi.fn((left: unknown, right: unknown) => ({ op: 'eq', left, right }))
}))

import { and, desc, eq } from 'drizzle-orm'

import type { DbClient } from '../src/db/client'
import { lernaSessions } from '../src/db/schema'
import { DrizzleSessionsRepo } from '../src/repositories/drizzle-sessions-repo'

const USER_ID = '00000000-0000-4000-8000-000000000010'
const OTHER_USER_ID = '00000000-0000-4000-8000-000000000011'
const SESSION_ID = '00000000-0000-4000-8000-000000000001'

const sessionRow = {
  id: SESSION_ID,
  userId: USER_ID,
  startedAt: new Date('2026-01-01T00:00:00.000Z'),
  endedAt: null,
  durationSec: 0,
  subject: 'Math',
  tags: ['algebra'],
  notes: null,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z')
}

type ChainBuilder = {
  from: ReturnType<typeof vi.fn>
  where: ReturnType<typeof vi.fn>
  orderBy: ReturnType<typeof vi.fn>
  values: ReturnType<typeof vi.fn>
  set: ReturnType<typeof vi.fn>
  returning: ReturnType<typeof vi.fn>
}

function makeDb(returningRows: unknown[] = [sessionRow]) {
  const builder: ChainBuilder = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockResolvedValue(returningRows),
    values: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue(returningRows)
  }

  const rawDb = {
    select: vi.fn().mockReturnValue(builder),
    insert: vi.fn().mockReturnValue(builder),
    update: vi.fn().mockReturnValue(builder),
    delete: vi.fn().mockReturnValue(builder)
  }

  return {
    db: rawDb as unknown as DbClient,
    rawDb,
    builder
  }
}

describe('DrizzleSessionsRepo', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('list(userId) selects sessions by user_id and maps Date fields to ISO strings', async () => {
    const { db, rawDb, builder } = makeDb()
    const repo = new DrizzleSessionsRepo(db)

    const result = await repo.list(USER_ID)

    expect(rawDb.select).toHaveBeenCalledTimes(1)
    expect(builder.from).toHaveBeenCalledWith(lernaSessions)
    expect(eq).toHaveBeenCalledWith(lernaSessions.userId, USER_ID)
    expect(desc).toHaveBeenCalledWith(lernaSessions.startedAt)

    const userFilter = vi.mocked(eq).mock.results[0]?.value
    const startedAtOrder = vi.mocked(desc).mock.results[0]?.value

    expect(builder.where).toHaveBeenCalledWith(userFilter)
    expect(builder.orderBy).toHaveBeenCalledWith(startedAtOrder)

    expect(result).toEqual([
      {
        id: SESSION_ID,
        userId: USER_ID,
        startedAt: '2026-01-01T00:00:00.000Z',
        endedAt: null,
        durationSec: 0,
        subject: 'Math',
        tags: ['algebra'],
        notes: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z'
      }
    ])
  })

  it('create(userId, input) inserts a row with ownership user_id and returns a Session', async () => {
    const { db, rawDb, builder } = makeDb()
    const repo = new DrizzleSessionsRepo(db)

    const result = await repo.create(USER_ID, {
      durationSec: 60,
      subject: 'Math',
      tags: ['algebra'],
      notes: null
    })

    expect(rawDb.insert).toHaveBeenCalledWith(lernaSessions)
    expect(builder.values).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: USER_ID,
        durationSec: 60,
        subject: 'Math',
        tags: ['algebra'],
        notes: null
      })
    )
    expect(builder.returning).toHaveBeenCalledTimes(1)
    expect(result.id).toBe(SESSION_ID)
    expect(result.startedAt).toBe('2026-01-01T00:00:00.000Z')
  })

  it('update(userId, id, input) filters by both session id and user_id to prevent IDOR', async () => {
    const { db, rawDb, builder } = makeDb()
    const repo = new DrizzleSessionsRepo(db)

    const result = await repo.update(USER_ID, SESSION_ID, {
      subject: 'Physics',
      endedAt: '2026-01-01T00:30:00.000Z'
    })

    expect(rawDb.update).toHaveBeenCalledWith(lernaSessions)
    expect(builder.set).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: 'Physics',
        endedAt: new Date('2026-01-01T00:30:00.000Z'),
        updatedAt: expect.any(Date)
      })
    )

    expect(eq).toHaveBeenCalledWith(lernaSessions.id, SESSION_ID)
    expect(eq).toHaveBeenCalledWith(lernaSessions.userId, USER_ID)
    expect(and).toHaveBeenCalledTimes(1)

    const ownershipFilter = vi.mocked(and).mock.results[0]?.value
    expect(builder.where).toHaveBeenCalledWith(ownershipFilter)
    expect(result?.id).toBe(SESSION_ID)
  })

  it('update(userId, id, input) returns null when no owned row is found', async () => {
    const { db } = makeDb([])
    const repo = new DrizzleSessionsRepo(db)

    const result = await repo.update(OTHER_USER_ID, SESSION_ID, {
      subject: 'Should not update'
    })

    expect(eq).toHaveBeenCalledWith(lernaSessions.id, SESSION_ID)
    expect(eq).toHaveBeenCalledWith(lernaSessions.userId, OTHER_USER_ID)
    expect(and).toHaveBeenCalledTimes(1)
    expect(result).toBeNull()
  })

  it('delete(userId, id) filters by both session id and user_id and returns false when not found', async () => {
    const { db, rawDb, builder } = makeDb([])
    const repo = new DrizzleSessionsRepo(db)

    const result = await repo.delete(USER_ID, SESSION_ID)

    expect(rawDb.delete).toHaveBeenCalledWith(lernaSessions)
    expect(eq).toHaveBeenCalledWith(lernaSessions.id, SESSION_ID)
    expect(eq).toHaveBeenCalledWith(lernaSessions.userId, USER_ID)
    expect(and).toHaveBeenCalledTimes(1)
    expect(builder.returning).toHaveBeenCalledWith({ id: lernaSessions.id })
    expect(result).toBe(false)
  })
})
