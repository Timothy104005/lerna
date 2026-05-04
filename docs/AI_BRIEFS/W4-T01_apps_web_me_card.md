# W4-T01 — apps/web Vite + React 19 + TS PoC：`/me` 個人資料卡

## Meta
- **task_id**: W4-T01_apps_web_me_card
- **phase**: W4 前端從零打造（W4 第 1 件，PoC 跑通整套 build pipeline）
- **executor**: Codex Local
- **預估工時**: 0.5–1 天
- **依賴**: services/api `/me` endpoint 已在 W2-T01 完成，CORS 已 allow `http://localhost:5173`（W2-T02 完成）

## Goal

把 `apps/web/` 從目前的 stub（`src/index.ts = export {};`、scripts 全 `echo "stub"`）改成可跑的 **Vite + React 19 + TypeScript** workspace，做一個 PoC 頁面：

- UI：一張「我的個人資料」卡片，欄位 `id` / `email`
- 取得方式：fetch `services/api/me`，header `Authorization: Bearer <token>`
- Token 來源（dev only）：UI 上一個 input 讓使用者貼 JWT，存 `localStorage.lerna_web_dev_token`；沒 token 就顯示「請貼 dev token」
- error handling：401 → 顯示 problem+json 的 `title`；網路錯誤 → 顯示 message；429 → 顯示 retry 提示

**成功條件**：
1. `npm run -w @lerna/web typecheck` 0 error
2. `npm run -w @lerna/web build` 產生 `apps/web/dist/`
3. `npm run -w @lerna/web dev` 跑起 Vite dev server 在 `http://localhost:5173`
4. 同時跑 services/api dev（port 8787），瀏覽器開 5173、貼合法 token、看到 `id` + `email` 顯示出來（**使用者手動驗**）
5. 沒貼 token 看到 fallback UI；貼錯 token 看到「Unauthorized」訊息（從 problem+json 的 `title` 顯示）

**不做**（嚴格）：
- 不引入 Tailwind / shadcn / CSS-in-JS lib（pure CSS file 即可）
- 不引入 react-router（一個 page，App 直接 render）
- 不引入 axios / swr / react-query（原生 fetch 即可）
- 不接 Supabase Auth SDK / UI（W4-T03 或 W5 處理；本任務 token 由使用者手貼）
- 不寫 unit test / 不裝 vitest / RTL（W4-T02 sessions list 再導入；本任務以 typecheck + build + 手動驗為驗收）
- 不動 `Lerna.html` 一個字節（ground truth，違反就是越界）
- 不動 `services/api/**` 任何檔（W2/W3 已穩，本任務重點在前端）
- 不動 root `netlify.toml` / `vercel.json`（W4-T02 拆完才動 buildCommand）
- 不動 root `package.json`（dep 加在 `apps/web/package.json` 自己的 workspace）
- 不動 `scripts/build-site.js`（它服務於 Lerna.html，跟 apps/web 不互通）

## Context Files

### 要新增

- `apps/web/index.html` — Vite entry HTML，含 `<div id="root"></div>` + `<script type="module" src="/src/main.tsx"></script>`
- `apps/web/vite.config.ts` — `@vitejs/plugin-react` + `server.port = 5173`（明示）
- `apps/web/.env.example` — 列 `VITE_API_BASE_URL=http://localhost:8787`
- `apps/web/src/main.tsx` — `ReactDOM.createRoot` mount `<App />`（**React 19 寫法**）
- `apps/web/src/App.tsx` — root component，render `<MeCard />` + dev token input
- `apps/web/src/components/MeCard.tsx` — 顯示 id / email 的卡片，內含 fetch `/me` 邏輯（或抽到 hook，自由）
- `apps/web/src/components/DevTokenInput.tsx` — input + 「Save」/「Clear」按鈕，操作 localStorage `lerna_web_dev_token`
- `apps/web/src/lib/api.ts` — fetch wrapper，自動帶 `Authorization: Bearer <token>` + 處理 problem+json error response
- `apps/web/src/lib/config.ts` — 讀 `import.meta.env.VITE_API_BASE_URL`，default `http://localhost:8787`
- `apps/web/src/styles.css` — 最小化：reset + 卡片 / input 基本樣式

### 要修改（覆寫既有 stub）

- `apps/web/package.json` — 加 dep 與 scripts
- `apps/web/tsconfig.json` — 加 `jsx: "react-jsx"`、`types: ["vite/client"]`
- `apps/web/README.md` — 換成「dev：`npm run -w @lerna/web dev` + `npm run -w services/api dev`，貼 token 進 UI」說明

### 要刪除

- `apps/web/src/index.ts` — 換成 `main.tsx`（不要保留 placeholder）

### 禁止觸碰（do-not-touch，sounds 嚴格）

**Lerna.html ground truth + 既有部署設定**：
- `Lerna.html`
- `lernav*.html`、`v11test.html`、`YPT++ v*.html`（任何 monolithic html 全部）
- `netlify.toml`
- `vercel.json`
- `lerna.webmanifest`
- `service-worker.js`
- `assets/**`（包含 ypt-tools-react-v18.js 等）
- `scripts/build-site.js`、`scripts/build-cloud-sync.js`、`scripts/build-mobile-web.js`、`scripts/pack-site-zip.ps1`、`scripts/verify-deploy.js`、`scripts/w1_cleanup.ps1`

**services/api 全部不動**：
- `services/api/src/**`（包含 `index.ts` 的 path-scoped middleware 4 行 — auth.ts 也不動）
- `services/api/tests/**`
- `services/api/vitest.config.ts`、`tsconfig.json`、`drizzle.config.ts`、`.env.example`、`.env`
- `services/api/package.json`、`services/api/package-lock.json`
- `supabase/migrations/**`

**apps/mobile 也不動**（這是 W9 Capacitor 對齊的範疇）：
- `apps/mobile/**`

**Root 設定**：
- root `package.json`（不加新 dep，apps/web 自己加）
- root `package-lock.json`（會被 npm install 動到，但**不准手改**）
- root `tsconfig.base.json`
- root `turbo.json`
- root `.gitignore`、`.editorconfig`、`.prettierrc`（如有）
- `.github/**`
- `docs/**`、`HANDOVER_*.md`、`Lerna_*.md`、`Lerna_*.pdf`、`README.md`、`SETUP_GIT.md`、`CODEX_PROMPT_*.md`

**packages/**：
- `packages/**`（W4-T01 不建共用 package；之後抽 i18n / fetch wrapper 到共用 package 是 W5+ 的事）

## 設計細節

### `apps/web/package.json`（覆寫）

```json
{
  "name": "@lerna/web",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "typecheck": "tsc -b --noEmit",
    "lint": "echo \"@lerna/web lint stub: eslint will be added in W4-T02\"",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react": "^4.3.4",
    "typescript": "~5.6.0",
    "vite": "^6.0.0"
  }
}
```

版本說明（**Codex 不准擅自降級或升級**）：
- React 19.x — 對齊 Lerna.html 內 `react.transitional.element` / `react.activity` symbols
- Vite 6.x — 2026-05 當前穩定線
- TS 5.6.x — 對齊 monorepo
- 如果 npm install 失敗（peer dep 衝突），先回報實際錯誤再決定修，**不准自己改 dep 版本**

### `apps/web/tsconfig.json`（覆寫）

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "jsx": "react-jsx",
    "types": ["vite/client"],
    "noEmit": true
  },
  "include": ["src", "vite.config.ts"]
}
```

不要加 `composite` / project references（root 沒設，加了會破壞 turbo）。

### `apps/web/index.html`

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Lerna — apps/web (PoC)</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

### `apps/web/vite.config.ts`

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true
  }
})
```

`strictPort: true` 是為了避免 5173 被佔用時 Vite 自動跳到其他 port，破壞 services/api 的 CORS allow list。

### `apps/web/src/main.tsx`（React 19 寫法）

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import './styles.css'

const root = document.getElementById('root')
if (!root) throw new Error('root element missing')
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>
)
```

### `apps/web/src/lib/config.ts`

```ts
export const config = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8787'
}
```

### `apps/web/src/lib/api.ts`

```ts
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
  constructor(public status: number, public problem: ProblemBody | null, message: string) {
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
    throw new ApiError(res.status, problem, problem?.title ?? `HTTP ${res.status}`)
  }
  return (await res.json()) as T
}

export type MeResponse = {
  id: string
  email: string | null
}

export const getMe = () => apiFetch<MeResponse>('/me')
```

### `apps/web/src/components/DevTokenInput.tsx`

```tsx
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
        <button type="button" onClick={save}>Save</button>
        <button type="button" onClick={clear}>Clear</button>
      </div>
    </div>
  )
}
```

### `apps/web/src/components/MeCard.tsx`

```tsx
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
          setState({ kind: 'error', message: err.message, status: err.status })
        } else {
          setState({ kind: 'error', message: err instanceof Error ? err.message : String(err) })
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
        <dt>id</dt><dd>{state.me.id}</dd>
        <dt>email</dt><dd>{state.me.email ?? '(null)'}</dd>
      </dl>
    </div>
  )
}
```

### `apps/web/src/App.tsx`

```tsx
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
```

### `apps/web/src/styles.css`

最小化（不超過 50 行）：reset、`.app` max-width 600px、`.card` 邊框 + padding、`.error` 紅字、`.dev-token textarea` 寬度撐滿、`button` 基本樣式。

### `apps/web/.env.example`

```
VITE_API_BASE_URL=http://localhost:8787
```

### `apps/web/README.md`（覆寫）

```md
# @lerna/web

Lerna 前端 PoC（W4-T01）。Vite + React 19 + TypeScript。

## Dev

兩個 terminal：

terminal 1（API）：
\`\`\`
npm run -w services/api dev
\`\`\`

terminal 2（web）：
\`\`\`
cp apps/web/.env.example apps/web/.env  # 第一次
npm run -w @lerna/web dev
\`\`\`

開 `http://localhost:5173`，貼 Supabase JWT access_token 進 dev token input，按 Save，看到 `/me` 回傳的 id + email。

## Build

\`\`\`
npm run -w @lerna/web build
\`\`\`
產出 `apps/web/dist/`。
```

## Constraints

- React 19 + Vite 6 + TS 5.6 strict
- 不加 Tailwind / shadcn / axios / react-router / swr / react-query / vitest / RTL
- 不動 services/api、Lerna.html、netlify.toml、vercel.json、root package.json
- 不寫 unit test
- token 存 localStorage key **必須是 `lerna_web_dev_token`**（避免跟 ai-sidecar 的 `ypt_app_state_v6` / `lerna_ai_v1` 撞名）
- Vite dev server port 必須 5173（CORS allow list 對齊）
- API base url 預設 `http://localhost:8787`（services/api default port）
- `tsconfig.json` 不准開 `composite`（破壞 turbo）

## Acceptance

```powershell
cd C:\Code\Lerna
npm install                                        # 安裝新 dep
npm run -w @lerna/web typecheck                    # 0 error
npm run -w @lerna/web build                        # 產 apps/web/dist/
ls apps/web/dist/                                  # 應有 index.html + assets/
```

dev server 手動驗（**使用者跑、回貼結果**）：

```powershell
# terminal 1
npm run -w services/api dev
# terminal 2
npm run -w @lerna/web dev
```

開瀏覽器：
- `http://localhost:5173` 應顯示「Lerna apps/web — PoC」標題 + dev token input + 「請貼 dev token 後按 Save」
- 貼合法 Supabase JWT → 顯示 `id` + `email`
- 貼亂打 token → 顯示 `Error (401) Unauthorized`
- 開 devtools Network，看 `GET /me` 走 `Authorization: Bearer <token>`、response Content-Type 對

### Diff 邊界

```powershell
git status
git diff --stat
```

預期改動（新增 / 修改 / 刪除）：
- 新增 11 檔（apps/web/index.html / vite.config.ts / .env.example、src/main.tsx、App.tsx、components/MeCard.tsx、components/DevTokenInput.tsx、lib/api.ts、lib/config.ts、styles.css，README 改寫不算新增）
- 修改 3 檔（apps/web/package.json、tsconfig.json、README.md）
- 刪除 1 檔（apps/web/src/index.ts）
- root `package-lock.json` 會被 npm install 動到（接受，但**不准手改 lock**）

**不准出現**任何下列檔的 diff：
- `Lerna.html`、`lernav*.html`、`v11test.html`、`YPT++ v*.html`、`netlify.toml`、`vercel.json`、`lerna.webmanifest`、`service-worker.js`、`assets/**`
- `scripts/**`
- `services/api/**`、`supabase/**`
- `apps/mobile/**`
- `packages/**`
- `.github/**`、`docs/**`、`HANDOVER_*.md`、`Lerna_*.md`、`Lerna_*.pdf`、`README.md`、`SETUP_GIT.md`、`CODEX_PROMPT_*.md`
- root `package.json`、`tsconfig.base.json`、`turbo.json`、`.gitignore`

## Risk

- **React 19 createRoot API**：如果 Codex 寫成 React 18 的 `ReactDOM.render(...)` 是錯的（R18+ 已 deprecate）。brief 已給 R19 寫法樣板
- **`@vitejs/plugin-react` 跟 React 19 相容性**：截至 2026-05，4.3+ 已支援 R19；如 Codex 跑 npm install 遇 peer dep warning，先回報，**不准自降版本**
- **Vite 6 vs 5**：本 brief 用 6.x。如果 install 失敗，Codex 回報後再決定
- **TypeScript strict + React 19 types**：`children` 的型別 R19 改成 explicit prop，Codex 必須在每個 component prop 寫對 type；不准用 `React.FC`（R19 不推薦）
- **CORS 撞牆**：services/api 的 CORS allow list 預設只有 `http://localhost:5173`，所以 Vite **必須** strictPort 5173。如果 Codex 想用其他 port（3000 / 5174），不行
- **localStorage 在 Vite SSR 時不存在**：Vite 預設 client-only，理論上沒事；但如果 Codex 引入 SSR / RSC 寫法（不該引入），會炸。brief 已禁止
- **`import.meta.env` 沒讀到 `VITE_API_BASE_URL`**：Vite 要求 `.env` 在 apps/web 根（不是 root）。brief README 已寫
- **使用者沒有 Supabase JWT 可貼**：dev 階段先用 `services/api/tests` 裡 mock 的方式產一個短期 JWT，或 Codex 在 README 裡寫個小指引（從 Supabase Dashboard → Auth → user → access_token；或從 Lerna.html dev console 撈當前登入 user 的 token）。**brief 不要求 Codex 實作這個**，只要求 PoC UI 能接受 token
- **Codex 偷殺**（紅旗，依 §4.4）：
  - 想簡化 path / 動 services/api 的 auth path-scoped middleware：拒絕，根本不在本任務範圍
  - 想動 Lerna.html「順便升級」：拒絕，越界
  - 想加 Tailwind 「讓 UI 漂亮」：拒絕，PoC 不需要
  - 想塞 vitest「驗 React component」：拒絕，W4-T02 才導入
  - 想接 Supabase Auth UI：拒絕，W4-T03 / W5
  - 想動 root `package.json`：拒絕，dep 在 apps/web 自己 workspace
  - 想動 netlify.toml / vercel.json：拒絕，W4-T02 才動

## ChatGPT Router Prompt

```
你是 Codex Local 的 prompt 工程師。任務：把 apps/web 從 stub 改成可跑的 Vite + React 19 + TypeScript workspace，做一個 PoC 頁面顯示 services/api/me 回傳的 id + email，token 由使用者手貼進 UI 存 localStorage。請把下面 brief 翻譯成可貼進 Codex CLI 的 prompt：

要求：
1. 開頭明列「要新增的檔案」「要修改的檔案」「要刪除的檔案」「禁止觸碰的檔案」四段，逐一檔名
2. 強調「不加 Tailwind / shadcn / axios / react-router / swr / react-query / vitest / RTL」
3. 強調「不動 services/api 任何檔；不動 Lerna.html / netlify.toml / vercel.json / root package.json；不動 apps/mobile / packages / supabase / scripts」
4. 強調「React 19 寫法（createRoot from react-dom/client；不准用 ReactDOM.render；不准用 React.FC）」
5. 強調「Vite dev server port 必須是 5173（strictPort: true）— 因為 services/api CORS 只 allow 5173」
6. 強調「token localStorage key 必須是 lerna_web_dev_token，避免跟 ai-sidecar 撞」
7. 強調「TypeScript strict；tsconfig 不准開 composite；jsx: react-jsx」
8. 提供 apps/web/package.json / tsconfig.json / vite.config.ts / index.html / main.tsx / App.tsx / lib/api.ts / lib/config.ts / components/MeCard.tsx / components/DevTokenInput.tsx 完整 code（brief 內已給）
9. 強調「dep 版本固定：react 19.x、react-dom 19.x、@vitejs/plugin-react 4.3+、vite 6.x、typescript 5.6.x；不准自降版本，install 失敗先回報」
10. 強調「dev 與 build 必須跑得起來，使用者會手動驗瀏覽器」
11. 結尾驗收指令清單：npm install / typecheck / build / 確認 dist 結構 / git diff --stat 邊界
12. 強調「完成回報請貼 npm install 是否乾淨、tsc 結果、vite build 結果、git status / git diff --stat、apps/web/dist 結構」
13. 強調「不准動 services/api/src/index.ts 的 path-scoped middleware（auth 4 行；歷史紅旗，本任務根本不在 services/api 範圍）」
14. 繁體中文 prose、code 與技術名詞用英文

Brief：
[把 W4-T01 整份 brief 貼進來]
```

## 完成回報模板

```
## W4-T01 完成回報
- [ ] npm install 結果：[貼最後 5 行；有沒有 peer dep warning / vulnerability 數]
- [ ] typecheck 綠：[貼 `npm run -w @lerna/web typecheck` 最後 5 行]
- [ ] vite build 綠：[貼最後 5 行 + dist 大小]
- [ ] apps/web/dist 結構：[貼 ls 結果]
- [ ] dev server 啟動 OK：[「Local: http://localhost:5173」是否出現]
- [ ] git status：[貼]
- [ ] git diff --stat：[貼]
- [ ] 邊界檢查（services/api / Lerna.html / netlify.toml / vercel.json / apps/mobile / packages / scripts / supabase / .github / docs / root package.json / turbo.json / tsconfig.base.json 全 0 diff；root package-lock.json 允許動）：[列每組]
- [ ] 偏離 brief 的決策：[列]
- [ ] 想得到的 React 19 / Vite 6 / TS 5.6 install 雷：[列]

## 待使用者手動驗（瀏覽器）
- [ ] http://localhost:5173 顯示「Lerna apps/web — PoC」+ dev token input + 「請貼 dev token 後按 Save」
- [ ] 貼合法 Supabase JWT → 顯示 id + email
- [ ] 貼亂打 token → 顯示 Error (401) Unauthorized
- [ ] devtools Network /me 走 Authorization: Bearer <token>、Content-Type 正確

下一個 brief 候選（W4-T02 sessions list + 導入 vitest + RTL）：[寫]
```
