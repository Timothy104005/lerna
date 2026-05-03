import { extendZodWithOpenApi } from '@hono/zod-openapi'
import { z } from 'zod'
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

export const ValidationErrorResponseSchema = z
  .object({
    error: z.literal('Invalid request'),
    details: z.object({
      formErrors: z.array(z.string()),
      fieldErrors: z.record(z.array(z.string()))
    })
  })
  .openapi('ValidationErrorResponse')

export const UnauthorizedResponseSchema = z
  .object({
    error: z.literal('Unauthorized')
  })
  .openapi('UnauthorizedResponse')

export const NotFoundResponseSchema = z
  .object({
    error: z.literal('Not found')
  })
  .openapi('NotFoundResponse')

export const RateLimitResponseSchema = z
  .object({
    error: z.literal('Too Many Requests')
  })
  .openapi('RateLimitResponse')
