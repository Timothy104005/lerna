# W3-T02 — Structured Logging + Request ID

## Meta
- **task_id**: W3-T02_logging
- **phase**: W3 觀測性（OpenAPI / **logging** / errors，本週第 2 件）
- **executor**: Codex Local
- **預估工時**: 0.5 天
- **依賴**: W3-T01 vitest 19/19 全綠（已過 ✅）

## Goal
給 API 加上**結構化 logging** 與 **per-request request id**：

1. 每個 HTTP request 進來時：產 / 取 `X-Request-Id`，寫進 response header；attach 到 `c.var.requestId`
2. 每個 request 出去時 log 一行 JSON：`{ level, time, method, path, status, durationMs, requestId, userSub }`
3. NODE_ENV=test 時 logger **完全靜音**（vitest 不能多噪音）
4. NODE_ENV=development 時用 `pino-pretty` 上色給 dev terminal 看
5. NODE_ENV=production 時用預設 pino JSON output（給未來 W10 部署接 log aggregator）
6. 19 vitest case 完全不改、不刪、必須全綠
7. `/healthz`、`/openapi.json`、`/docs` 三個雜訊源**不 log**（避免 healthcheck 把 prod log 灌爆）

**不做**：
- 不在 route handler 裡 log 自定義事件（W3-T03 統一錯誤格式時再說）
- 不接 OpenTelemetry / external aggregator（W10 部署再評）
- 不改錯誤格式（W3-T03 才做 problem+json）
- 不加 metrics endpoint

## Context Files

### 要新增
- `services/api/src/lib/logger.ts` — pino instance；test mode silent、dev mode pretty、prod mode JSON
- `services/api/src/middleware/request-id.ts` — request id middleware + module augmentation 註冊 `requestId: string` 進 `hono` 的 `ContextVariableMap`
- `services/api/src/middleware/logging.ts` — 出口 log middleware（method / path / status / durationMs / requestId / userSub）

### 要修改（限定）
- `services/api/package.json`（**只能加 2 個 dep**）：
  - `pino`（最新穩定版；對 Node 20 兼容）→ runtime dep
  - `pino-pretty`（最新穩定版）→ **devDependency**（dev 看得舒服，prod / test 不需要）
  - **不要動其他 dep 版本、不要動 scripts**
- `services/api/src/index.ts`：
  - 中介順序新增（**重要，順序如下**）：
    1. `app.use('*', apiCors)` — 不動
    2. `app.use('*', requestIdMiddleware)` — **新加**
    3. `app.use('*', loggingMiddleware)` — **新加**
    4. `app.use('*', ipRateLimit)` — 不動（保持原位置）
    5. 其餘（healthz / openapi / docs / auth / routes）不動
  - 為什麼 request-id 在 cors 後 / rate-limit 前：rate-limit 觸發時也要有 request id 寫進 res header（debug 友善）
  - 為什麼 logging 在 rate-limit 前：rate-limit 回 429 時也要 log（觀察被 ban 的客戶）

### 禁止觸碰（逐檔絕對路徑，相對 repo root）

W2 穩定基礎：
- `services/api/src/middleware/auth.ts`
- `services/api/src/middleware/cors.ts`
- `services/api/src/middleware/rate-limit.ts`
- `services/api/src/env.ts`

Domain types / repositories / db：
- `services/api/src/types/session.ts`
- `services/api/src/repositories/sessions-repo.ts`
- `services/api/src/repositories/in-memory-sessions-repo.ts`
- `services/api/src/repositories/drizzle-sessions-repo.ts`
- `services/api/src/repositories/index.ts`
- `services/api/src/db/client.ts`
- `services/api/src/db/schema.ts`

W3-T01 已收尾的檔（**整層 routes 跟 openapi 不准動**）：
- `services/api/src/openapi/app.ts`
- `services/api/src/openapi/schemas.ts`
- `services/api/src/routes/healthz.ts`
- `services/api/src/routes/me.ts`
- `services/api/src/routes/sessions.ts`

Tests（19 case 是 ground truth）：
- `services/api/tests/setup.ts`
- `services/api/tests/me.test.ts`
- `services/api/tests/rate-limit.test.ts`
- `services/api/tests/sessions.test.ts`
- `services/api/tests/drizzle-sessions-repo.test.ts`

設定檔：
- `services/api/vitest.config.ts`
- `services/api/tsconfig.json`
- `services/api/drizzle.config.ts`
- `services/api/.env.example`

W1 範圍 / 越界紀錄：
- root `package.json`、root `.env.example`
- `Lerna.html`、`lernav*.html`、`netlify.toml`、`vercel.json`
- `.github/workflows/**`、`supabase/**`、`docs/**`
- `apps/**`、`packages/**`、其他 `services/**` 子資料夾

## 設計細節

### `src/lib/logger.ts`

```ts
import { pino, type Logger } from 'pino'
import { env } from '../env'

function createLogger(): Logger {
  if (env.NODE_ENV === 'test') {
    return pino({ level: 'silent' })
  }

  if (env.NODE_ENV === 'development') {
    return pino({
      level: 'debug',
      transport: {
        target: 'pino-pretty',
        options: { colorize: true, translateTime: 'SYS:HH:MM:ss.l' }
      }
    })
  }

  // production
  return pino({ level: 'info' })
}

export const logger = createLogger()
```

### `src/middleware/request-id.ts`

```ts
import type { MiddlewareHandler } from 'hono'

declare module 'hono' {
  interface ContextVariableMap {
    requestId: string
  }
}

const REQUEST_ID_HEADER = 'X-Request-Id'
const ID_REGEX = /^[A-Za-z0-9_-]{1,128}$/  // 只接受安全字元，避免 log injection

export const requestIdMiddleware: MiddlewareHandler = async (c, next) => {
  const incoming = c.req.header(REQUEST_ID_HEADER)
  const requestId = incoming && ID_REGEX.test(incoming) ? incoming : crypto.randomUUID()

  c.set('requestId', requestId)
  c.header(REQUEST_ID_HEADER, requestId)

  await next()
}
```

注意：
- `crypto.randomUUID()` 是 Node 20+ global，不需 import（Node 20 在 W1 已釘）
- `declare module 'hono'` 把 `requestId: string` 註冊進全域 `ContextVariableMap`，這樣 `c.set('requestId', ...)` 與 `c.var.requestId` 都 type-safe，**不需要動 AuthEnv 或 createOpenApiHono**

### `src/middleware/logging.ts`

```ts
import type { MiddlewareHandler } from 'hono'
import { logger } from '../lib/logger'

const SILENT_PATHS = new Set(['/healthz', '/openapi.json', '/docs'])

export const loggingMiddleware: MiddlewareHandler = async (c, next) => {
  const start = Date.now()
  const path = new URL(c.req.url).pathname

  try {
    await next()
  } finally {
    if (!SILENT_PATHS.has(path)) {
      const userSub = (c.get('user') as { sub?: string } | undefined)?.sub
      logger.info(
        {
          requestId: c.get('requestId'),
          method: c.req.method,
          path,
          status: c.res.status,
          durationMs: Date.now() - start,
          userSub
        },
        'request'
      )
    }
  }
}
```

注意：
- 用 `try/finally` 確保即使 handler throw 也會 log
- `c.get('user')` 在 protected route 才有；用 type guard 防 undefined
- `SILENT_PATHS` 排除 `/healthz`、`/openapi.json`、`/docs`
- log message 用 `'request'` 字串，metadata 在第一個 arg（pino 慣例）
- **不 log request body / headers**（避免漏 token、PII）

### `src/index.ts` diff（精準位置）

原本：
```ts
app.use('*', apiCors)
app.use('*', ipRateLimit)

// Public routes
app.route('/healthz', healthzRoute)
```

改後：
```ts
app.use('*', apiCors)
app.use('*', requestIdMiddleware)
app.use('*', loggingMiddleware)
app.use('*', ipRateLimit)

// Public routes
app.route('/healthz', healthzRoute)
```

其餘 32 行**完全不動**。

## Constraints

### 依賴
- 只能加 `pino`（dependencies）+ `pino-pretty`（devDependencies）
- 不要加 `hono-pino` 或其他 logging wrapper（自寫 middleware 已夠）
- 不要動其他 dep 版本

### 行為一致（19 vitest 全綠）
- 所有 endpoint 的 status code / response body / 錯誤格式**完全不變**
- request-id middleware 只新加 `X-Request-Id` response header — **vitest 沒有任何測試斷言 res headers，所以不會破測試**（W2-T01/T02/T03 grep 過、皆未 assert headers）
- logging middleware 在 NODE_ENV=test 下走 pino silent → 沒任何 stdout 噪音

### TypeScript strict
- module augmentation 寫在 `request-id.ts` 即可，**不要新增 `src/types/` 下檔案**（types/ 只放 domain types）
- logger.ts 用 `import { pino, type Logger } from 'pino'`，避免 default import（pino v9+ 是 named export）

### Pino 版本與 export 形式
- pino v9 主流（Node 20 對應）；如果 Codex 裝下來是 v9 一定用 named import
- 如果撞到 ESM/CJS interop 問題，貼錯誤回 review

## Acceptance

### 指令
```powershell
cd C:\Code\Lerna
npm install --workspace services/api
npm run -w services/api typecheck
npm test --workspace services/api
```

預期：
1. `npm install` 安裝 `pino` 與 `pino-pretty`，**沒有其他 dep 變動**
2. `typecheck` 0 error
3. `vitest` **19/19 全綠，不准多、不准少**
4. vitest 執行期間 stdout **不應出現任何 pino log**（test mode silent 的證明）

### 手動驗（dev 起來）
```powershell
npm run -w services/api dev
# 另一個 terminal：
curl http://localhost:8787/me   # 預期 401
curl -H "X-Request-Id: my-trace-abc" http://localhost:8787/me  # 預期 401，res 含 X-Request-Id: my-trace-abc
curl http://localhost:8787/healthz  # 預期 200，但 dev terminal **不應有 log line**
```

dev terminal 應該看到（pretty format，類似）：
```
[16:32:14.123] INFO: request
    requestId: "550e8400-e29b-41d4-a716-446655440000"
    method: "GET"
    path: "/me"
    status: 401
    durationMs: 1
```

### Diff 邊界
```powershell
git status
git diff --stat
```

預期改動只在：
- `services/api/package.json`（多 1 dep + 1 devDep）
- `package-lock.json`（root 自動）
- `services/api/src/index.ts`（多 2 行 use + 2 行 import）
- `services/api/src/lib/logger.ts`（新增）
- `services/api/src/middleware/request-id.ts`（新增）
- `services/api/src/middleware/logging.ts`（新增）

**不准出現**任何下列檔的 diff：
- `services/api/src/middleware/auth.ts` / `cors.ts` / `rate-limit.ts`
- `services/api/src/repositories/**`、`services/api/src/db/**`、`services/api/src/types/**`、`services/api/src/openapi/**`
- `services/api/src/routes/**`
- `services/api/src/env.ts`
- `services/api/tests/**`
- `services/api/vitest.config.ts` / `tsconfig.json` / `drizzle.config.ts` / `.env.example`
- root 任何檔（除 package-lock.json）
- `.github/**`、`supabase/**`、`docs/**`、`apps/**`、`packages/**`
- `Lerna.html`、`netlify.toml`、`vercel.json`、`lernav*.html`

## Risk

- **pino v9 / Node 20 ESM**：pino 對 ESM 支援已穩，但 transport 用 worker thread；某些 Windows 環境會延遲 spawn pino-pretty worker。dev mode 第一次跑 log 會慢一點點。**沒功能風險**
- **module augmentation 重複註冊**：如果 Codex 把 `declare module 'hono'` 放兩個地方會撞型別。請集中在 `request-id.ts` 一處
- **test mode 真的 silent 嗎**：pino `level: 'silent'` 是官方支援的「禁用所有 log」。即使 logger.info 被呼叫也不會輸出。但 transport（pino-pretty）在 silent level 下不會被 spawn，乾淨
- **`c.res.status` 在 try/finally 裡可能是 undefined**：如果 handler 整個 throw 而沒 return Response，`c.res` 在某些 Hono 版本是 undefined。處理：log 時用 `c.res?.status ?? 500` 兜底
- **logging middleware 跟 OpenAPI defaultHook 互動**：defaultHook 在 zod validation 失敗時直接 `c.json(..., 400)` return；loggingMiddleware 會 log 到那次 400。OK，這正是要的行為
- **Codex 偷殺**：上一輪 Codex 把 `app.use('/sessions', authMiddleware); app.use('/sessions/*', authMiddleware)` 簡化成 `:id?`（W3-T01 期間 Claude 改回）。本任務 do-not-touch 嚴格，**`src/index.ts` 除了新加 4 行外完全不准動其他行**，特別注意 auth path-scoped middleware 兩段不准合併
- **Codex 自作主張加 logger 進 route handler**：本任務不在 route 內 log，請 Codex 不要動 routes 任何檔

## ChatGPT Router Prompt

```
你是 Codex Local 的 prompt 工程師。任務：給 services/api 加 pino 結構化 logging 與 X-Request-Id middleware，但 routes 跟 W3-T01 已完成的 openapi/ 不准動。請把下面 brief 翻譯成可貼進 Codex CLI 的 prompt：

要求：
1. 開頭明列「要新增的檔案」「要修改的檔案」「禁止觸碰的檔案」三段，逐一檔名（禁止觸碰超過 25 個檔，必須全列）
2. 強調「只能在 services/api/package.json 加 pino（dep）+ pino-pretty（devDep），不可動其他 dep」
3. 強調「19 個現有 vitest case 完全不改、不刪、必須全綠；vitest 期間 stdout 不應出現任何 pino log」
4. 強調「routes/* 與 openapi/* 完全不准動」
5. 強調「src/index.ts 除了新加 2 行 use + 2 行 import，其他全保留 — 特別是 auth path-scoped middleware 仍是 4 行（/me /me/* /sessions /sessions/*），不准合併成 :id?」
6. 提供 logger.ts、request-id.ts、logging.ts 的完整 TypeScript（含 module augmentation）
7. 提供 src/index.ts 的精準 diff（only 4 行新增）
8. 強調 NODE_ENV=test → pino silent；NODE_ENV=development → pino-pretty；NODE_ENV=production → default JSON
9. 強調 SILENT_PATHS = /healthz, /openapi.json, /docs 不 log
10. 結尾驗收指令清單：npm install / typecheck / test，與 git diff 邊界檢查
11. 強調「完成回報請貼 git diff src/index.ts 全部行（驗有沒有偷改其他行）」
12. 繁體中文 prose、code 與技術名詞用英文

Brief：
[把 W3-T02 整份 brief 貼進來]
```

## 完成回報模板

```
## W3-T02 完成回報
- [ ] npm install 只多 pino（dep）+ pino-pretty（devDep）：[貼 package.json diff]
- [ ] typecheck 綠：[貼最後 5 行]
- [ ] vitest 19/19 全綠，stdout 無 pino 噪音：[貼摘要 + 確認 stdout 乾淨 Y/N]
- [ ] git diff src/index.ts 全部行（驗只多 4 行）：[整段貼]
- [ ] git diff --stat：[貼]
- [ ] 邊界檢查（middleware/auth.ts / cors.ts / rate-limit.ts / repositories / db / types / openapi / routes / tests / env 全 0 diff）：[列每組]
- [ ] dev mode 手動驗（curl /me 看 X-Request-Id header）：[貼結果或註明使用者驗]
- 偏離 brief 的決策：[列]
- 下一個 brief 候選（W3-T03 problem+json 統一錯誤格式）：[寫]
```
