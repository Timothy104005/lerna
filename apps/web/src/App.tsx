import { useState } from 'react'
import { DevTokenInput } from './components/DevTokenInput'
import { MeCard } from './components/MeCard'

export function App() {
  const [refreshKey, setRefreshKey] = useState(0)

  return (
    <main className="app">
      <h1>Lerna apps/web — PoC</h1>
      <DevTokenInput onChange={() => setRefreshKey((k) => k + 1)} />
      <MeCard refreshKey={refreshKey} />
    </main>
  )
}
