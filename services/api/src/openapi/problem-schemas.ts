import { extendZodWithOpenApi } from '@hono/zod-openapi'
import { z } from 'zod'

extendZodWithOpenApi(z)

const ProblemBaseSchema = z.object({
  type: z.string().url(),
  title: z.string(),
  status: z.number().int(),
  detail: z.string().optional(),
  instance: z.string().optional()
})

export const ProblemResponseSchema = ProblemBaseSchema.openapi('Problem')

export const ValidationProblemSchema = ProblemBaseSchema.extend({
  errors: z.object({
    formErrors: z.array(z.string()),
    fieldErrors: z.record(z.array(z.string()))
  })
}).openapi('ValidationProblem')
