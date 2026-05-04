import { config } from './config'

const TOKEN_KEY = 'lerna_web_dev_token'

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY) ?? '',
  set: (t: string) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY)
}

export type ProblemBody = {
  type: string
  title: string
  status: number
  detail?: string
  [k: string]: unknown
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public problem: ProblemBody | null,
    message: string
  ) {
    super(message)
  }
}

export async function apiFetch<T>(path: string): Promise<T> {
  const token = tokenStore.get()
  const res = await fetch(`${config.apiBaseUrl}${path}`, {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    }
  })

  const ct = res.headers.get('content-type') ?? ''

  if (!res.ok) {
    let problem: ProblemBody | null = null

    if (ct.includes('application/problem+json')) {
      problem = (await res.json()) as ProblemBody
    }

    throw new ApiError(
      res.status,
      problem,
      problem?.title ?? `HTTP ${res.status}`
    )
  }

  return (await res.json()) as T
}

export type MeResponse = {
  id: string
  email: string | null
}

export const getMe = () => apiFetch<MeResponse>('/me')
