# W3-T03 — Unified Error Format (RFC 7807 problem+json)

## Meta
- **task_id**: W3-T03_problem_json
- **phase**: W3 觀測性（OpenAPI / logging / **errors**，本週第 3 件、W3 收尾）
- **executor**: Codex Local
- **預估工時**: 0.5–1 天
- **依賴**: W3-T02 vitest 19/19 全綠（已過 ✅）

## Goal
把所有 error response 統一改成 RFC 7807 `application/problem+json` 格式：

```json
{
  "type": "https://lerna.app/problems/<slug>",
  "title": "Human-readable summary",
  "status": 400,
  "detail": "Optional longer explanation",
  "instance": "/sessions/abc-123",
  "<extensions>": "..."
}
```

**這個任務性質就是改 API contract，所以 tests 必須跟著改**——這跟前兩件 brief 不同，本任務**允許**也**要求**動 `tests/me.test.ts`、`tests/rate-limit.test.ts`、`tests/sessions.test.ts` 的 error 斷言。

成功條件：
1. 所有 error response 走 `Content-Type: application/problem+json`
2. body 符合 RFC 7807 的 `{ type, title, status }` 三必欄 + 視情況 `detail` / `instance` / extensions
3. typecheck 0 error
4. vitest 19/19（**斷言 shape 改成 problem+json**，case 數不變）
5. `/openapi.json` 的 error response schemas 同步更新

**不做**：
- 不加新 dep（純 shape 重寫）
- 不改 success response（200 / 201 / 204 全部維持）
- 不改 endpoint URL / method / status code（只改 body shape 與 Content-Type）
- 不寫新 endpoint
- 不引入 i18n（title 用英文即可）

## Context Files

### 要新增
- `services/api/src/lib/problem.ts` — RFC 7807 helper：`problem()` 主函式 + 具名 helpers `unauthorized()` `notFound()` `validationFailed(zodError)` `invalidJsonBody()` `tooManyRequests()`
- `services/api/src/openapi/problem-schemas.ts` — zod schema for problem responses（取代 `openapi/schemas.ts` 既有 ErrorResponse 系列；要 `extendZodWithOpenApi(z)` 後 `.openapi('Problem')`）

### 要修改
- `services/api/src/middleware/auth.ts` — `unauthorized()` 改用 `problem()` helper；保持 `MiddlewareHandler<AuthEnv>` 簽名與 `AuthUser` / `AuthEnv` type 不動
- `services/api/src/middleware/rate-limit.ts` — `hono-rate-limiter` 的 `message` 改成 problem object；如果 lib 不能控制 Content-Type，加 custom `handler` 強制 set `application/problem+json` header
- `services/api/src/routes/sessions.ts` — 所有 `c.json({ error: ... }, 4xx)` 改用 `problem()` helpers；`readJsonBody` 失敗的 400 用 `invalidJsonBody()`；zod safeParse 失敗的 400 用 `validationFailed(parsed.error)`；not found 用 `notFound()`
- `services/api/src/openapi/app.ts` — `defaultHook` 改用 `validationFailed()` helper；錯誤格式 100% 一致
- `services/api/src/openapi/schemas.ts` — 把 `ValidationErrorResponseSchema` / `UnauthorizedResponseSchema` / `NotFoundResponseSchema` / `RateLimitResponseSchema` 重寫成 problem schema（或改從 `problem-schemas.ts` re-export）。**保留** `MeResponseSchema` / `HealthzResponseSchema` / `SessionResponseSchema` / `SessionsResponseSchema` / `CreateSessionRequestSchema` / `UpdateSessionRequestSchema` / `SessionIdParamSchema` 不動
- `services/api/tests/me.test.ts` — 401 斷言改：`expect(res.headers.get('content-type')).toContain('application/problem+json')` + `expect(body).toMatchObject({ type: '...', title: 'Unauthorized', status: 401 })`
- `services/api/tests/rate-limit.test.ts` — 429 斷言同上，title `'Too Many Requests'`
- `services/api/tests/sessions.test.ts` — 400（zod / invalid JSON）、404 三類錯誤斷言改 problem shape

### 禁止觸碰

W2 / W3-T01 / W3-T02 的非 error 邏輯：
- `services/api/src/middleware/cors.ts`
- `services/api/src/middleware/request-id.ts`（W3-T02 收尾）
- `services/api/src/middleware/logging.ts`（W3-T02 收尾）
- `services/api/src/lib/logger.ts`（W3-T02 收尾）
- `services/api/src/env.ts`
- `services/api/src/types/session.ts`
- `services/api/src/repositories/sessions-repo.ts`
- `services/api/src/repositories/in-memory-sessions-repo.ts`
- `services/api/src/repositories/drizzle-sessions-repo.ts`
- `services/api/src/repositories/index.ts`
- `services/api/src/db/client.ts`
- `services/api/src/db/schema.ts`
- `services/api/src/routes/healthz.ts`（沒 error）
- `services/api/src/routes/me.ts`（handler 不動；若 createRoute response schema 引用了改寫過的 error schema 可微調引用，**不准動 200 response handler 邏輯**）
- `services/api/src/index.ts`（中介順序、auth path-scoped 4 行、healthz / openapi / docs 註冊全保留；本任務**不准動 index.ts**）
- `services/api/tests/setup.ts`
- `services/api/tests/drizzle-sessions-repo.test.ts`（沒測 error response shape）
- `services/api/vitest.config.ts` / `tsconfig.json` / `drizzle.config.ts` / `.env.example`
- `services/api/package.json`（**本任務不加新 dep**）
- root 任何檔、`Lerna.html`、`netlify.toml`、`vercel.json`、`lernav*.html`
- `.github/**`、`supabase/**`、`docs/**`、`apps/**`、`packages/**`

## 設計細節

### `src/lib/problem.ts`

```ts
import type { Context } from 'hono'
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

export function problem<S extends number>(
  c: Context,
  status: S,
  body: Omit<ProblemBody, 'status'>
) {
  c.header('Content-Type', 'application/problem+json')
  return c.json({ ...body, status } as ProblemBody, status)
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
  return problem(c, 400, {
    type: PROBLEM_TYPES.validation,
    title: 'Invalid request',
    detail: 'Body validation failed',
    errors: error.flatten()  // { formErrors: string[], fieldErrors: Record<string, string[]> }
  })
}
```

注意：
- `errors` 是 RFC 7807 允許的擴充欄位（非保留欄位都可加）
- 保留現有 `formErrors` / `fieldErrors` 結構在 `errors` 欄位下，方便 client 繼續 parse 結構化錯誤

### `src/openapi/problem-schemas.ts`

```ts
import { z } from 'zod'

const ProblemBaseSchema = z.object({
  type: z.string().url(),
  title: z.string(),
  status: z.number().int(),
  detail: z.string().optional(),
  instance: z.string().optional()
})

export const ProblemResponseSchema = ProblemBaseSchema.openapi('Problem')

export const ValidationProblemSchema = ProblemBaseSchema.extend({
  errors: z.object({
    formErrors: z.array(z.string()),
    fieldErrors: z.record(z.array(z.string()))
  })
}).openapi('ValidationProblem')
```

`openapi/schemas.ts` 內把 `ValidationErrorResponseSchema` 等 4 個 export 改成 re-export from `problem-schemas.ts`（或直接刪除舊定義改名引用）。

### `src/middleware/auth.ts`（最小改動）

```ts
import { unauthorized } from '../lib/problem'

// 把原本 function unauthorized(c) { return c.json({ error: 'Unauthorized' }, 401) } 整支刪掉
// 把所有 return unauthorized(c) 維持原樣（symbol 名一致），但 import source 從本檔內換到 ../lib/problem
```

關鍵：**不准動 `AuthUser` / `AuthVariables` / `AuthEnv` 三個 type export**、不准動 `extractBearerToken` helper、不准動 `authMiddleware` 的 token 驗證邏輯（exp / sub 檢查、jwt verify）。只准動 `unauthorized` 的實作來源。

### `src/middleware/rate-limit.ts`

```ts
import { rateLimiter } from 'hono-rate-limiter'
import { tooManyRequests } from '../lib/problem'
import type { AuthEnv } from './auth'

export const ipRateLimit = rateLimiter<AuthEnv>({
  windowMs: 60 * 1000,
  limit: 60,
  keyGenerator: (c) => c.req.header('x-forwarded-for') ?? 'unknown',
  skip: (c) => c.req.path === '/healthz',
  handler: (c) => tooManyRequests(c)
})
```

如果 `hono-rate-limiter` 沒 `handler` option（lib 名稱可能是 `handler` / `onLimitReached`），Codex 自行查 lib 文件選對的 hook，**目標：429 response 走 problem+json**。

### tests 改寫對照表

| Test | 原斷言 | 新斷言 |
|---|---|---|
| `me.test.ts` 401 (× 2) | `expect(res.status).toBe(401); expect(body).toEqual({ error: 'Unauthorized' })` | `expect(res.status).toBe(401); expect(res.headers.get('content-type')).toContain('application/problem+json'); expect(body).toMatchObject({ type: 'https://lerna.app/problems/unauthorized', title: 'Unauthorized', status: 401 })` |
| `rate-limit.test.ts` 429 | `expect(limitedBody).toEqual({ error: 'Too Many Requests' })` | `expect(limitedBody).toMatchObject({ type: 'https://lerna.app/problems/too-many-requests', title: 'Too Many Requests', status: 429 })` |
| `sessions.test.ts` 400 zod | `expect(body.error).toBe('Invalid request')` | `expect(body).toMatchObject({ type: 'https://lerna.app/problems/validation', title: 'Invalid request', status: 400 }); expect(body.errors).toMatchObject({ fieldErrors: expect.any(Object), formErrors: expect.any(Array) })` |
| `sessions.test.ts` 404 (× 2) | `expect(body).toEqual({ error: 'Not found' })` | `expect(body).toMatchObject({ type: 'https://lerna.app/problems/not-found', title: 'Not found', status: 404 })` |
| `rate-limit.test.ts` 401（在 limited 後 reset 重試的那 case 也驗 401） | 同 me.test.ts 401 | 同 me.test.ts 401 新斷言 |

注意：**case 數一律不變**（19 個）。只改斷言內容，不刪 case、不加 case。如果 Codex 想加新 case 驗 problem schema 完整性，**不准**——這個任務是 contract migration，不是 coverage expansion。

### Content-Type 斷言

每個改寫的 error 斷言都要驗 `res.headers.get('content-type')` 包含 `'application/problem+json'`。這是 RFC 7807 的核心要求，缺它就不算遷移完成。

## Constraints

- 不加新 dep
- 不動 19 個 vitest case 的 **數量**（4 / 3 / 7 / 5 = 19 不變）
- 不動 success response（200 / 201 / 204 全部維持原 shape 與 Content-Type）
- TypeScript strict
- `c.header('Content-Type', 'application/problem+json')` 必須在 `c.json(...)` 之前 set，否則 hono 會用預設 application/json overwrite

## Acceptance

```powershell
cd C:\Code\Lerna
npm run -w services/api typecheck    # 0 error
npm test --workspace services/api    # 19/19 全綠
```

具體：
- typecheck 綠
- vitest 4 個 test files / 19 cases 全綠
- vitest stdout 仍**沒有 pino 噪音**（W3-T02 silent 機制不該被本任務破）
- `/openapi.json` 內 4xx / 429 response 的 schema 改用 `Problem` / `ValidationProblem`（手動驗，dev server）

### Diff 邊界
```powershell
git status
git diff --stat
```

預期改動：
- `services/api/src/lib/problem.ts`（新增）
- `services/api/src/openapi/problem-schemas.ts`（新增）
- `services/api/src/middleware/auth.ts`（小幅 — `unauthorized` 改用 helper）
- `services/api/src/middleware/rate-limit.ts`（改用 helper / handler option）
- `services/api/src/routes/sessions.ts`（多處 error response 改）
- `services/api/src/openapi/app.ts`（defaultHook 用 validationFailed）
- `services/api/src/openapi/schemas.ts`（4 個 error schema 重寫 / re-export）
- `services/api/tests/me.test.ts`、`rate-limit.test.ts`、`sessions.test.ts`（斷言改）

**不准出現**任何下列檔的 diff：
- `services/api/src/index.ts`
- `services/api/src/middleware/cors.ts` / `request-id.ts` / `logging.ts`
- `services/api/src/lib/logger.ts`
- `services/api/src/env.ts`
- `services/api/src/types/**`
- `services/api/src/repositories/**`
- `services/api/src/db/**`
- `services/api/src/routes/healthz.ts`
- `services/api/src/routes/me.ts`（除非引用的 schema 名變了；引用調整可以，handler 邏輯不動）
- `services/api/tests/setup.ts`
- `services/api/tests/drizzle-sessions-repo.test.ts`
- `services/api/vitest.config.ts` / `tsconfig.json` / `drizzle.config.ts` / `.env.example`
- `services/api/package.json` / `package-lock.json`
- root、`.github/**`、`supabase/**`、`docs/**`、`apps/**`、`packages/**`、`Lerna.html`、`netlify.toml`、`vercel.json`、`lernav*.html`

## Risk

- **`hono-rate-limiter` handler option**：lib 可能名為 `handler` 或 `onLimitReached`。Codex 必須查文件選對的 hook，並 verify 429 response 確實走 `application/problem+json` Content-Type。如果 lib 限制太多，可改用 `app.use('*', ipRateLimit)` 之外另接一層 wrapper middleware 把 429 重 wrap（次選，brief 偏好原生 hook）
- **OpenAPIHono `c.header('Content-Type', ...)` 與 `c.json(...)` 順序**：`c.json(...)` 預設會 set content-type。Hono 4 的行為是「`c.header` 設了之後 `c.json` 不會 overwrite」——但要 verify。如果 verify 不過，`problem()` helper 改用 `new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/problem+json' } })` 直接 return，繞過 `c.json`
- **createRoute response schema 跟實際 body shape 不一致**：openapi/schemas.ts 改完後，routes/sessions.ts 與 routes/me.ts 引用的 schema 名要對齊。typecheck 會抓
- **defaultHook 回的型別**：`@hono/zod-openapi` 的 defaultHook 簽名要回 `Response` 或 `void`。Codex 直接 `return validationFailed(c, result.error)` 即可（problem helper 已 return Response）
- **Codex 偷殺**：上次 Codex 把 auth path 簡化成 `:id?`（W3-T01）。本任務 do-not-touch 嚴格寫了 `index.ts`，`auth.ts` 內也只准動 `unauthorized` 一個 helper、其他全保留
- **Codex 想加 dep（如 `http-problem-details` lib）**：拒絕。30 行手寫 helper 已夠
- **tests 改寫量**：4 / 3 / 7 = 14 個 case 要改斷言。每個改 1–3 行。Codex 第一輪可能漏 1–2 個，多跑一輪即可

## ChatGPT Router Prompt

```
你是 Codex Local 的 prompt 工程師。任務：把 services/api 所有 error response 統一改成 RFC 7807 application/problem+json，包含 middleware、routes、tests、OpenAPI schemas。請把下面 brief 翻譯成可貼進 Codex CLI 的 prompt：

要求：
1. 開頭明列「要新增的檔案」「要修改的檔案」「禁止觸碰的檔案」三段，逐一檔名
2. 強調「不可加新 dep；不可動 src/index.ts；不可動 success response（200 / 201 / 204）」
3. 強調「19 個 vitest case 數量不變；只改斷言內容；不准多開 case」
4. 強調「auth path-scoped middleware 在 src/index.ts 仍是 4 行，本任務根本不准動 index.ts」
5. 強調「middleware/auth.ts 只准把 unauthorized helper 換成 ../lib/problem 的 import；其他全保留——AuthUser / AuthVariables / AuthEnv type、extractBearerToken、authMiddleware token 驗證邏輯都不准動」
6. 提供 src/lib/problem.ts 完整 TypeScript（含 PROBLEM_TYPES const + 5 個 helpers）
7. 提供 tests 改寫對照表（每個 endpoint × 每個錯誤 status × 新斷言完整 code）
8. 強調每個 error 斷言都要驗 Content-Type 含 application/problem+json
9. 強調 hono-rate-limiter 的 handler option（不確定就查 lib 文件、回報實際採用方式）
10. 結尾驗收指令清單：typecheck / test，與 git diff 邊界檢查
11. 強調「完成回報請貼 git diff src/middleware/auth.ts 全部行（驗只動 unauthorized）」
12. 繁體中文 prose、code 與技術名詞用英文

Brief：
[把 W3-T03 整份 brief 貼進來]
```

## 完成回報模板

```
## W3-T03 完成回報
- [ ] typecheck 綠：[貼最後 5 行]
- [ ] vitest 19/19 全綠（case 數不變）：[貼摘要]
- [ ] vitest stdout 仍無 pino 噪音：[Y/N]
- [ ] git diff src/middleware/auth.ts 全部行（驗只動 unauthorized）：[整段貼]
- [ ] git diff --stat：[貼]
- [ ] 邊界檢查（index.ts / cors / request-id / logging / logger / env / types / repositories / db / healthz route / setup / drizzle test / 設定檔 / package.json 全 0 diff）：[列每組]
- [ ] /openapi.json 改用 Problem schemas（手動驗 dev server）：[貼結果或註明使用者驗]
- [ ] hono-rate-limiter 採用的 hook（handler / onLimitReached / wrapper）：[寫]
- 偏離 brief 的決策：[列]
- W3 全收尾，下一個 brief 候選（W4 開始拆 apps/web，從 Lerna.html 抽模組）：[寫]
```
