import { OpenAPIHono, type Hook } from '@hono/zod-openapi'
import type { AuthEnv } from '../middleware/auth'

export const defaultHook: Hook<unknown, AuthEnv, '', unknown> = (result, c) => {
  if (!result.success) {
    return c.json(
      {
        error: 'Invalid request',
        details: result.error.flatten()
      },
      400
    )
  }
}

export function createOpenApiHono() {
  return new OpenAPIHono<AuthEnv>({ defaultHook })
}
