import type { NewSession, Session, UpdateSession } from '../types/session'

export interface SessionsRepo {
  list(userId: string): Promise<Session[]>
  create(userId: string, input: NewSession): Promise<Session>
  update(userId: string, id: string, input: UpdateSession): Promise<Session | null>
  delete(userId: string, id: string): Promise<boolean>
}
