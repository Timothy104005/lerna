import type { Context, TypedResponse } from 'hono'
import type { ContentfulStatusCode } from 'hono/utils/http-status'
import type { z } from 'zod'

export const PROBLEM_BASE = 'https://lerna.app/problems'

export const PROBLEM_TYPES = {
  validation: `${PROBLEM_BASE}/validation`,
  invalidJsonBody: `${PROBLEM_BASE}/invalid-json-body`,
  unauthorized: `${PROBLEM_BASE}/unauthorized`,
  notFound: `${PROBLEM_BASE}/not-found`,
  tooManyRequests: `${PROBLEM_BASE}/too-many-requests`
} as const

export type ProblemType = typeof PROBLEM_TYPES[keyof typeof PROBLEM_TYPES]

export type ProblemBody = {
  type: string
  title: string
  status: number
  detail?: string
  instance?: string
  [extension: string]: unknown
}

type ProblemResponse<
  B extends Omit<ProblemBody, 'status'>,
  S extends ContentfulStatusCode
> = Response & TypedResponse<B & { status: S }, S, 'json'>

export function problem<
  S extends ContentfulStatusCode,
  B extends Omit<ProblemBody, 'status'>
>(
  c: Context,
  status: S,
  body: B
) {
  const problemBody = { ...body, status }
  const headers = new Headers(c.res.headers)

  headers.set('content-type', 'application/problem+json')

  return new Response(JSON.stringify(problemBody), {
    status,
    headers
  }) as ProblemResponse<B, S>
}

export function unauthorized(c: Context) {
  return problem(c, 401, {
    type: PROBLEM_TYPES.unauthorized,
    title: 'Unauthorized'
  })
}

export function notFound(c: Context, detail?: string) {
  return problem(c, 404, {
    type: PROBLEM_TYPES.notFound,
    title: 'Not found',
    detail
  })
}

export function tooManyRequests(c: Context) {
  return problem(c, 429, {
    type: PROBLEM_TYPES.tooManyRequests,
    title: 'Too Many Requests'
  })
}

export function invalidJsonBody(c: Context) {
  return problem(c, 400, {
    type: PROBLEM_TYPES.invalidJsonBody,
    title: 'Invalid request',
    detail: 'Request body is not valid JSON',
    errors: {
      formErrors: ['Invalid JSON body'],
      fieldErrors: {}
    }
  })
}

export function validationFailed(c: Context, error: z.ZodError) {
  const flattened = error.flatten()

  return problem(c, 400, {
    type: PROBLEM_TYPES.validation,
    title: 'Invalid request',
    detail: 'Body validation failed',
    errors: {
      formErrors: flattened.formErrors,
      fieldErrors: flattened.fieldErrors as Record<string, string[]>
    }
  })
}
