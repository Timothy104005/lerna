import { useEffect, useState } from 'react'
import { ApiError, getMe, tokenStore, type MeResponse } from '../lib/api'

type State =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ok'; me: MeResponse }
  | { kind: 'error'; message: string; status?: number }

export function MeCard({ refreshKey }: { refreshKey: number }) {
  const [state, setState] = useState<State>({ kind: 'idle' })

  useEffect(() => {
    if (!tokenStore.get()) {
      setState({ kind: 'idle' })
      return
    }

    let cancelled = false

    setState({ kind: 'loading' })

    getMe()
      .then((me) => {
        if (!cancelled) setState({ kind: 'ok', me })
      })
      .catch((err) => {
        if (cancelled) return

        if (err instanceof ApiError) {
          const message =
            err.status === 429
              ? `${err.message}. Retry later; rate limit may be active.`
              : err.message

          setState({ kind: 'error', message, status: err.status })
        } else {
          setState({
            kind: 'error',
            message: err instanceof Error ? err.message : String(err)
          })
        }
      })

    return () => {
      cancelled = true
    }
  }, [refreshKey])

  if (state.kind === 'idle') return <p>請貼 dev token 後按 Save</p>
  if (state.kind === 'loading') return <p>Loading…</p>

  if (state.kind === 'error') {
    return (
      <div className="card error">
        <strong>Error{state.status ? ` (${state.status})` : ''}</strong>
        <p>{state.message}</p>
      </div>
    )
  }

  return (
    <div className="card">
      <h2>Me</h2>
      <dl>
        <dt>id</dt>
        <dd>{state.me.id}</dd>
        <dt>email</dt>
        <dd>{state.me.email ?? '(null)'}</dd>
      </dl>
    </div>
  )
}
