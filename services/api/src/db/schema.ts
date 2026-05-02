import { index, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

export const users = pgTable('lerna_profiles', {
  userId: uuid('user_id').primaryKey(),
  email: text('email'),
  displayName: text('display_name'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
})

export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert

export const lernaSessions = pgTable(
  'lerna_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull(),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    endedAt: timestamp('ended_at', { withTimezone: true }),
    durationSec: integer('duration_sec').notNull().default(0),
    subject: text('subject'),
    tags: text('tags').array().notNull().default([]),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    userIdIdx: index('idx_lerna_sessions_user_id').on(table.userId),
    startedAtIdx: index('idx_lerna_sessions_started_at').on(table.startedAt)
  })
)

export type LernaSessionRow = typeof lernaSessions.$inferSelect
export type NewLernaSessionRow = typeof lernaSessions.$inferInsert
