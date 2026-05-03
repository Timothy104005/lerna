import { OpenAPIHono, type Hook } from '@hono/zod-openapi'
import { validationFailed } from '../lib/problem'
import type { AuthEnv } from '../middleware/auth'

export const defaultHook: Hook<unknown, AuthEnv, '', unknown> = (result, c) => {
  if (!result.success) {
    return validationFailed(c, result.error)
  }
}

export function createOpenApiHono() {
  return new OpenAPIHono<AuthEnv>({ defaultHook })
}
