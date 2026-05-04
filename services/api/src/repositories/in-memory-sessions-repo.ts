import type { NewSession, Session, UpdateSession } from '../types/session'
import type { SessionsRepo } from './sessions-repo'

const sessions = new Map<string, Session>()

function nowIso(): string {
  return new Date().toISOString()
}

export class InMemorySessionsRepo implements SessionsRepo {
  async list(userId: string): Promise<Session[]> {
    return Array.from(sessions.values()).filter((session) => session.userId === userId)
  }

  async create(userId: string, input: NewSession): Promise<Session> {
    const now = nowIso()

    const session: Session = {
      id: crypto.randomUUID(),
      userId,
      startedAt: input.startedAt ?? now,
      endedAt: null,
      durationSec: 0,
      subject: input.subject ?? null,
      tags: input.tags ?? [],
      notes: input.notes ?? null,
      createdAt: now,
      updatedAt: now
    }

    sessions.set(session.id, session)

    return session
  }

  async update(userId: string, id: string, input: UpdateSession): Promise<Session | null> {
    const existing = sessions.get(id)

    if (!existing || existing.userId !== userId) {
      return null
    }

    const updated: Session = {
      ...existing,
      ...input,
      updatedAt: nowIso()
    }

    sessions.set(id, updated)

    return updated
  }

  async delete(userId: string, id: string): Promise<boolean> {
    const existing = sessions.get(id)

    if (!existing || existing.userId !== userId) {
      return false
    }

    sessions.delete(id)

    return true
  }
}

export const inMemorySessionsRepo = new InMemorySessionsRepo()

export function resetSessionsRepo(): void {
  sessions.clear()
}
