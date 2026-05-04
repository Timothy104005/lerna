import { z } from 'zod'

export const SessionSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime().nullable(),
  durationSec: z.number().int().nonnegative(),
  subject: z.string().max(120).nullable(),
  tags: z.array(z.string().max(40)).max(20),
  notes: z.string().max(2000).nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
})

export type Session = z.infer<typeof SessionSchema>

export const NewSessionSchema = z.object({
  startedAt: z.string().datetime().optional(),
  subject: z.string().max(120).optional(),
  tags: z.array(z.string().max(40)).max(20).optional(),
  notes: z.string().max(2000).optional()
})

export type NewSession = z.infer<typeof NewSessionSchema>

export const UpdateSessionSchema = z.object({
  endedAt: z.string().datetime().nullable().optional(),
  durationSec: z.number().int().nonnegative().optional(),
  subject: z.string().max(120).nullable().optional(),
  tags: z.array(z.string().max(40)).max(20).optional(),
  notes: z.string().max(2000).nullable().optional()
})

export type UpdateSession = z.infer<typeof UpdateSessionSchema>
