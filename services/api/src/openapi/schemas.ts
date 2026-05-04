import { extendZodWithOpenApi } from '@hono/zod-openapi'
import { z } from 'zod'
import {
  ProblemResponseSchema,
  ValidationProblemSchema
} from './problem-schemas'
import {
  NewSessionSchema,
  SessionSchema,
  UpdateSessionSchema
} from '../types/session'

extendZodWithOpenApi(z)

export const SessionResponseSchema = SessionSchema.openapi('Session')

export const SessionsResponseSchema = z
  .array(SessionResponseSchema)
  .openapi('SessionsResponse')

export const CreateSessionRequestSchema =
  NewSessionSchema.openapi('CreateSessionRequest')

export const UpdateSessionRequestSchema =
  UpdateSessionSchema.openapi('UpdateSessionRequest')

export const SessionIdParamSchema = z.object({
  id: z.string().openapi({
    param: {
      name: 'id',
      in: 'path'
    }
  })
})

export const HealthzResponseSchema = z
  .object({
    ok: z.literal(true),
    version: z.string()
  })
  .openapi('HealthzResponse')

export const MeResponseSchema = z
  .object({
    id: z.string(),
    email: z.string().nullable()
  })
  .openapi('MeResponse')

export const ValidationErrorResponseSchema = ValidationProblemSchema

export const UnauthorizedResponseSchema = ProblemResponseSchema

export const NotFoundResponseSchema = ProblemResponseSchema

export const RateLimitResponseSchema = ProblemResponseSchema
