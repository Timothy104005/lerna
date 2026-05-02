# W3-T01 — OpenAPI Spec + Swagger UI

## Meta
- **task_id**: W3-T01_openapi
- **phase**: W3 觀測性（OpenAPI / logging / errors，本週第 1 件）
- **executor**: Codex Local（要跑 `npm install` + 本機 vitest）
- **預估工時**: 0.5 天
- **依賴**: W2-T04 vitest 19/19 全綠（已過 ✅）

## Goal
把現有 Hono API 的 routes 用 `@hono/zod-openapi` 重新註冊，自動產生 OpenAPI 3 spec 並暴露：

1. `GET /openapi.json`：完整 OpenAPI 3.0 spec
2. `GET /docs`：Swagger UI（可直接點 endpoints 試打）

**硬限制**：19 個現有 vitest case 完全不改、不刪、全部要綠。所有 endpoint 的 status code / response body / 錯誤格式 100% 維持。

**不做**：
- 不加 logging（W3-T02）
- 不改錯誤格式統一成 problem+json（W3-T03）
- 不寫 OpenAPI spec 的 contract test（型別已保證；如果想加一個小 test 驗 `/openapi.json` 回 200 + 包含預期 paths 是 OK 的，但非強制）

## Context Files

### 要新增
- `services/api/src/openapi/schemas.ts` — 從 `types/session.ts` re-import zod schemas，套 `.openapi(...)` metadata；新增 `MeResponse`、`HealthzResponse`、`ValidationErrorResponse`、`UnauthorizedResponse`、`NotFoundResponse`、`RateLimitResponse` 等 response schema
- `services/api/src/openapi/app.ts`（**選用**）— 如果 Codex 偏好把 `OpenAPIHono` 實例 + `defaultHook` 集中放這裡 export，可以；不集中、直接在 `index.ts` 與各 route 檔處理也 OK。決定權給 Codex，但必須一致

### 要修改
- `services/api/package.json`（**只能加 2 個 dep**）：
  - `@hono/zod-openapi`（最新穩定版；對 hono ^4 與 zod ^3.23 兼容）
  - `@hono/swagger-ui`（最新穩定版）
  - **不要動其他 dependency 版本、不要動 devDependencies、不要動 scripts**
- `services/api/src/index.ts`：
  - `new Hono<AuthEnv>()` → `new OpenAPIHono<AuthEnv>({ defaultHook })`，`defaultHook` 把 zod 失敗轉成現有錯誤格式（見下方 Constraints §驗證錯誤格式）
  - 在 `app.use('*', apiCors)` / `app.use('*', ipRateLimit)` 之後、auth middleware 之前，註冊：
    - `app.doc('/openapi.json', { openapi: '3.0.0', info: { title: 'Lerna API', version: '0.1.0' } })`
    - `app.get('/docs', swaggerUI({ url: '/openapi.json' }))`
  - 三個 `app.route(...)` 與兩段 `app.use('/me', authMiddleware)` / `app.use('/sessions', authMiddleware)` **保留結構**
  - `serve(...)` block 不動
- `services/api/src/routes/healthz.ts`：用 `OpenAPIHono` + `createRoute` 註冊 `GET /` 回 `HealthzResponse`
- `services/api/src/routes/me.ts`：用 `createRoute` 註冊 `GET /` 回 `MeResponse`，security 標 `bearerAuth`
- `services/api/src/routes/sessions.ts`：四個 endpoints（POST `/`、GET `/`、PATCH `/:id`、DELETE `/:id`）轉 `createRoute`，request body 與 response 用 `openapi/schemas.ts` 的 schema，security 標 `bearerAuth`。**handler 內部呼叫 `sessionsRepo.create/list/update/delete` 的邏輯與回傳行為必須完全等價**

### 禁止觸碰（逐檔絕對路徑，相對 repo root）

Middleware / 設定（這些是 W2 累積的穩定基礎，動了就要重 review）：
- `services/api/src/middleware/auth.ts`
- `services/api/src/middleware/cors.ts`
- `services/api/src/middleware/rate-limit.ts`
- `services/api/src/env.ts`

Domain types / repositories（schema 與資料層已穩）：
- `services/api/src/types/session.ts`
- `services/api/src/repositories/sessions-repo.ts`
- `services/api/src/repositories/in-memory-sessions-repo.ts`
- `services/api/src/repositories/drizzle-sessions-repo.ts`
- `services/api/src/repositories/index.ts`
- `services/api/src/db/client.ts`
- `services/api/src/db/schema.ts`

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
- root `package.json` / root `.env.example`
- `Lerna.html`、`lernav*.html`
- `netlify.toml`、`vercel.json`
- `.github/workflows/**`
- `supabase/**`
- `docs/**`（包含本 brief；Codex 只讀不寫）
- `apps/**`、`packages/**`、其他 `services/**` 子資料夾

## Constraints

### 依賴
- 只能在 `services/api/package.json` 加 `@hono/zod-openapi` 與 `@hono/swagger-ui`
- 不要動其他 dep 版本，不要 `npm audit fix`，不要重排 keys
- 不要 root install；只在 `services/api` workspace 加

### 行為一致（19 vitest 全綠的關鍵）
所有現有 endpoint 行為**逐字節等價**：

| Endpoint | Status | Body shape |
|---|---|---|
| `GET /healthz` | 200 | `{ ok: true, version: string }` |
| `GET /me`（無 token） | 401 | `{ error: 'Unauthorized' }` |
| `GET /me`（valid token） | 200 | `{ id: string, email: string \| null }` |
| `POST /sessions`（valid） | 201 | `Session`（見 `types/session.ts`） |
| `POST /sessions`（zod 失敗） | 400 | `{ error: 'Invalid request', details: { formErrors: string[], fieldErrors: Record<string, string[]> } }` |
| `POST /sessions`（invalid JSON） | 400 | 同上、`formErrors: ['Invalid JSON body']` |
| `GET /sessions` | 200 | `Session[]` |
| `PATCH /sessions/:id`（not found） | 404 | `{ error: 'Not found' }` |
| `DELETE /sessions/:id`（hit） | 204 | empty body |
| 任意 over rate-limit | 429 | `{ error: 'Too Many Requests' }` |

### 驗證錯誤格式（重點）
`@hono/zod-openapi` 預設 hook 會回 `{ success: false, error }`，**會直接打破 sessions.test.ts**。Codex 必須在 `OpenAPIHono` 建構時傳 `defaultHook`：

```ts
import type { Hook } from '@hono/zod-openapi'

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
```

並把這個 hook 同時用於 `index.ts` 的 root `OpenAPIHono` 與每個 sub-route 的 `OpenAPIHono`（如果 Codex 把 routes 拆成多個 `OpenAPIHono` 子 app）。**或者**只在 root app 設一次、sub-route 用普通 `Hono` 透過 `app.route()` 掛入也行——只要錯誤格式正確即可。

### 請求 body 失敗（`c.req.json()` 拋錯）
原 `sessions.ts` 的 `readJsonBody` 會 catch 並回 `formErrors: ['Invalid JSON body']`。`createRoute` 的 zod body validation 在 JSON 無法解析時的行為要驗。如果 `@hono/zod-openapi` 在這情況不走 `defaultHook`、改回 default 422，**Codex 必須保留原本的 `readJsonBody` helper 包在 handler 開頭**，確保 400 + `Invalid JSON body` 仍然出現。

### Public endpoints
- `/healthz`、`/openapi.json`、`/docs` 三者都不能被 auth middleware 攔
- 在 `index.ts` 的順序務必：cors → rate-limit → 註冊 `/healthz`、`/openapi.json`、`/docs` → 才註冊 auth middleware（`app.use('/me', ...)` / `app.use('/sessions', ...)`）→ 再 `app.route('/me', meRoute)` / `app.route('/sessions', sessionsRoute)`

### 其他
- TypeScript strict
- middleware/auth.ts 的 `AuthEnv` type 維持為 `OpenAPIHono` 的泛型參數
- swagger-ui 預設用 CDN 載資源（不要 vendor 進來）
- `app.doc(...)` 的 `info.version` 用 `'0.1.0'`（與 `package.json` 對齊；不要 dynamic 讀）

## Acceptance

### 指令
```powershell
cd C:\Code\Lerna
npm install --workspace services/api
npm run -w services/api typecheck
npm test --workspace services/api
```

預期：
1. `npm install` 安裝 `@hono/zod-openapi` 與 `@hono/swagger-ui`，**沒有其他 dep 變動**
2. `typecheck` 0 error
3. `vitest` **19/19 全綠，不准多、不准少**（如果 Codex 想加 1–2 個 OpenAPI smoke test 也可以，但要在「完成回報」明列）

### 手動驗（Codex 不必跑，使用者驗）
```powershell
npm run -w services/api dev
# 另一個 terminal：
curl http://localhost:8787/openapi.json
curl http://localhost:8787/docs
```
- `/openapi.json` 200，body 含 `paths` 至少有 `/healthz`、`/me`、`/sessions`、`/sessions/{id}`
- `/docs` 200 HTML（Swagger UI shell）

### Diff 邊界
```powershell
git status
git diff --stat
```

預期改動只在：
- `services/api/package.json`（**只有 dependencies 多兩行**）
- `services/api/package-lock.json`（自動）
- `services/api/src/index.ts`
- `services/api/src/routes/healthz.ts`
- `services/api/src/routes/me.ts`
- `services/api/src/routes/sessions.ts`
- `services/api/src/openapi/schemas.ts`（新增）
- `services/api/src/openapi/app.ts`（如 Codex 採用，可選）

**不准出現**任何下列檔的 diff：
- `services/api/src/middleware/**`
- `services/api/src/repositories/**`
- `services/api/src/db/**`
- `services/api/src/types/**`
- `services/api/src/env.ts`
- `services/api/tests/**`
- `services/api/vitest.config.ts` / `tsconfig.json` / `drizzle.config.ts` / `.env.example`
- root 任何檔
- `Lerna.html`、`netlify.toml`、`vercel.json`、`lernav*.html`
- `.github/**`、`supabase/**`、`docs/**`、`apps/**`、`packages/**`

## Risk

- **zod schema `.openapi()`**：`@hono/zod-openapi` 用 `extendZodWithOpenApi(z)` 擴 zod prototype。schemas 必須在 entry 早期 wrap 一次，否則 `.openapi(...)` 不會出現。Codex 在 `src/openapi/schemas.ts` 開頭 import 並執行 `extendZodWithOpenApi(z)` 即可
- **defaultHook 不觸發**：如果 `createRoute` 的 request schema 沒設 `request.body.content['application/json'].schema`，hook 不會跑。確認 sessions POST/PATCH 的 request body 確實有掛 zod schema
- **JSON parse 失敗**：見上方 Constraints §請求 body 失敗。如果 hook 沒接到，保留原 `readJsonBody` 包一層
- **路由順序**：`/openapi.json` / `/docs` 一定在 auth `app.use('/me', authMiddleware)` 之前。auth middleware 是 path-scoped 不是 `*`，所以理論安全，但路由順序仍要明確
- **rate-limit 跳過 `/openapi.json`、`/docs`**：目前 `ipRateLimit` 只 skip `/healthz`。Codex 可選擇也 skip 這兩個（推薦），但如果不 skip 也可（每分鐘 60 次對 dev 夠用）。**做選擇要在「完成回報」說明**
- **Codex 偷殺 `src/routes/sessions.ts` 的 readJsonBody**：完成回報 diff 要逐 endpoint 比對行為等價
- **新 dep 撞版本**：`@hono/zod-openapi` 與 hono 主版本要對齊（hono ^4 對應 `@hono/zod-openapi` ^0.16+）；如果 npm 報 peer warning，貼錯誤回我看
- **swagger-ui 在 NODE_ENV=test 下**：Swagger UI 不會被 vitest 觸發；但 `app.doc('/openapi.json', ...)` 會在每次 `app.fetch` 走過。確認沒副作用、不加載 swagger CDN

## ChatGPT Router Prompt

```
你是 Codex Local 的 prompt 工程師。任務：把 services/api 的 routes 用 @hono/zod-openapi 重新註冊、加 /openapi.json 與 /docs，但不能破壞 19 個現有 vitest case。請把下面 brief 翻譯成可貼進 Codex CLI 的 prompt：

要求：
1. 開頭明列「要新增的檔案」「要修改的檔案」「禁止觸碰的檔案」三段，逐一檔名（禁止觸碰超過 25 個檔，必須全列）
2. 強調「只能在 services/api/package.json 加 @hono/zod-openapi 與 @hono/swagger-ui，不可動其他 dep」
3. 強調「19 個現有 vitest case 完全不改、不刪、必須全綠」
4. 列出所有 endpoint 的 status code 與 response body shape 表，要求行為逐字節等價
5. 提供 defaultHook 的完整 TypeScript 範例，把 zod 失敗轉成 { error: 'Invalid request', details: result.error.flatten() } 與 400
6. 強調 POST/PATCH /sessions 的 invalid JSON 仍要回 400 + formErrors: ['Invalid JSON body']（保留 readJsonBody helper）
7. 強調 /healthz、/openapi.json、/docs 三者都不能被 auth middleware 攔；列出 index.ts 的中介順序
8. 要 schema 集中放 src/openapi/schemas.ts，from types/session.ts re-import 後 .openapi() wrap，不准動 types/session.ts
9. 強調 OpenAPIHono 用 AuthEnv 泛型；middleware 仍用現有 MiddlewareHandler<AuthEnv>，不准動 middleware
10. 結尾驗收指令清單：npm install / typecheck / test，與 git diff 邊界檢查
11. 強調「完成後回報 git diff --stat 與每個 endpoint 是否行為一致的逐項勾選」
12. 繁體中文 prose、code 與技術名詞用英文

Brief：
[把 W3-T01 整份 brief 貼進來]
```

## 完成回報模板

```
## W3-T01 完成回報
- [ ] npm install 只多兩個 dep（@hono/zod-openapi、@hono/swagger-ui）：[貼 package.json diff]
- [ ] typecheck 綠：[貼最後 5 行]
- [ ] vitest 19/19 全綠（或多 N 個 OpenAPI smoke test，請註明）：[貼摘要]
- [ ] /openapi.json 在 NODE_ENV=test 下也能訪問（用 app.fetch 跑一次驗）：[貼結果或註明 Codex 沒驗、由使用者跑 dev 驗]
- [ ] git diff --stat：[貼]
- [ ] 邊界檢查：middleware/repositories/db/types/env/tests/設定 全部 0 行 diff：[貼 git diff src/middleware src/repositories ...]
- [ ] 各 endpoint 行為勾選：
  - [ ] GET /healthz → 200 + { ok, version }
  - [ ] GET /me → 401 / 200 + { id, email }
  - [ ] POST /sessions → 201 / 400（zod）/ 400（invalid JSON, formErrors=['Invalid JSON body']）
  - [ ] GET /sessions → 200 + Session[]
  - [ ] PATCH /sessions/:id → 200 / 404
  - [ ] DELETE /sessions/:id → 204 / 404
  - [ ] rate-limit → 429
- [ ] rate-limit 是否 skip /openapi.json /docs：[Y/N + 理由]
- 偏離 brief 的決策：[列]
- 下一個 brief 候選（W3-T02 logging + request id with pino）：[寫]
```
