import { and, desc, eq } from 'drizzle-orm'

import type { DbClient } from '../db/client'
import {
  lernaSessions,
  type LernaSessionRow,
  type NewLernaSessionRow
} from '../db/schema'
import type { NewSession, Session, UpdateSession } from '../types/session'
import type { SessionsRepo } from './sessions-repo'

type CreateSessionInput = Omit<NewSession, 'notes' | 'subject'> & {
  endedAt?: string | null
  durationSec?: number
  notes?: string | null
  subject?: string | null
}

function dateToIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString()
}

function nullableDateToIso(value: Date | string | null): string | null {
  return value === null ? null : dateToIso(value)
}

function optionalIsoToDate(value: string | null | undefined): Date | null | undefined {
  if (value === undefined) return undefined
  if (value === null) return null
  return new Date(value)
}

export function rowToSession(row: LernaSessionRow): Session {
  return {
    id: row.id,
    userId: row.userId,
    startedAt: dateToIso(row.startedAt),
    endedAt: nullableDateToIso(row.endedAt),
    durationSec: row.durationSec,
    subject: row.subject ?? null,
    tags: row.tags ?? [],
    notes: row.notes ?? null,
    createdAt: dateToIso(row.createdAt),
    updatedAt: dateToIso(row.updatedAt)
  }
}

function toInsertRow(userId: string, input: CreateSessionInput): NewLernaSessionRow {
  const row: NewLernaSessionRow = {
    userId
  }

  if (input.startedAt !== undefined) {
    row.startedAt = new Date(input.startedAt)
  }

  if (input.endedAt !== undefined) {
    row.endedAt = optionalIsoToDate(input.endedAt)
  }

  if (input.durationSec !== undefined) {
    row.durationSec = input.durationSec
  }

  if (input.subject !== undefined) {
    row.subject = input.subject
  }

  if (input.tags !== undefined) {
    row.tags = input.tags
  }

  if (input.notes !== undefined) {
    row.notes = input.notes
  }

  return row
}

function toUpdateRow(input: UpdateSession): Partial<NewLernaSessionRow> {
  const row: Partial<NewLernaSessionRow> = {
    updatedAt: new Date()
  }

  if (input.endedAt !== undefined) {
    row.endedAt = optionalIsoToDate(input.endedAt)
  }

  if (input.durationSec !== undefined) {
    row.durationSec = input.durationSec
  }

  if (input.subject !== undefined) {
    row.subject = input.subject
  }

  if (input.tags !== undefined) {
    row.tags = input.tags
  }

  if (input.notes !== undefined) {
    row.notes = input.notes
  }

  return row
}

export class DrizzleSessionsRepo implements SessionsRepo {
  constructor(private readonly db: DbClient) {}

  async list(userId: string): Promise<Session[]> {
    const rows = await this.db
      .select()
      .from(lernaSessions)
      .where(eq(lernaSessions.userId, userId))
      .orderBy(desc(lernaSessions.startedAt))

    return rows.map(rowToSession)
  }

  async create(userId: string, input: CreateSessionInput): Promise<Session> {
    const [row] = await this.db
      .insert(lernaSessions)
      .values(toInsertRow(userId, input))
      .returning()

    return rowToSession(row)
  }

  async update(userId: string, id: string, input: UpdateSession): Promise<Session | null> {
    const [row] = await this.db
      .update(lernaSessions)
      .set(toUpdateRow(input))
      .where(and(eq(lernaSessions.id, id), eq(lernaSessions.userId, userId)))
      .returning()

    return row ? rowToSession(row) : null
  }

  async delete(userId: string, id: string): Promise<boolean> {
    const rows = await this.db
      .delete(lernaSessions)
      .where(and(eq(lernaSessions.id, id), eq(lernaSessions.userId, userId)))
      .returning({ id: lernaSessions.id })

    return rows.length > 0
  }
}
