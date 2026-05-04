import { useState } from 'react'
import { tokenStore } from '../lib/api'

export function DevTokenInput({ onChange }: { onChange: () => void }) {
  const [value, setValue] = useState(tokenStore.get())

  const save = () => {
    tokenStore.set(value.trim())
    onChange()
  }

  const clear = () => {
    tokenStore.clear()
    setValue('')
    onChange()
  }

  return (
    <div className="dev-token">
      <label htmlFor="dev-token-input">Dev token (Supabase JWT)</label>
      <textarea
        id="dev-token-input"
        rows={3}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="paste your access_token..."
      />
      <div className="actions">
        <button type="button" onClick={save}>
          Save
        </button>
        <button type="button" onClick={clear}>
          Clear
        </button>
      </div>
    </div>
  )
}
