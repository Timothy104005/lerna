# W2-T03 — Sessions Endpoint（CRUD，in-memory repo 先行）

## Meta
- **task_id**: W2-T03_sessions_endpoints
- **phase**: W2 後端骨架
- **executor**: Codex Local（檔案 5–7、需跑本機 vitest）
- **預估工時**: 0.5–1 天
- **依賴**: W2-T01 + W2-T02 vitest 全綠（已過 ✅）

## Goal
為 Lerna 的核心動詞「學習段落（session）」加上完整 REST CRUD：
- `POST   /sessions` — 開始一段學習
- `GET    /sessions` — 列出**自己的** sessions（不能看別人的）
- `PATCH  /sessions/:id` — 更新（例如 endedAt、subject、notes）
- `DELETE /sessions/:id` — 刪除自己的

**為了讓本任務 ≤ 1 天可完成**，repository 層先用 in-memory `Map`，**不接真 Postgres**。等 W2-T04 才把 repo 換成 Drizzle。`InMemorySessionsRepo` 與未來 `DrizzleSessionsRepo` 共用同一個 `SessionsRepo` interface，換掉時不動 routes。

## Context Files

**要新增**：
- `services/api/src/repositories/sessions-repo.ts` — `SessionsRepo` interface
- `services/api/src/repositories/in-memory-sessions-repo.ts` — 用 `Map<string, Session>` 實作
- `services/api/src/routes/sessions.ts` — 4 個 endpoint
- `services/api/src/types/session.ts` — `Session` / `NewSession` / `UpdateSession` types（用 zod schema）
- `services/api/tests/sessions.test.ts` — vitest 完整 case

**要修改**：
- `services/api/src/index.ts` — mount `/sessions` 並掛 `authMiddleware`（含 `/sessions` 與 `/sessions/*` 兩條 use）

**禁止觸碰**：
- `src/routes/healthz.ts`、`src/routes/me.ts`
- `src/middleware/**`、`src/env.ts`
- `tests/me.test.ts`、`tests/rate-limit.test.ts`、`tests/setup.ts`
- `vitest.config.ts`、`tsconfig.json`、`package.json`（**本任務不加新依賴**，zod / hono 已在）
- `src/db/**`（W2-T04 才動 Drizzle schema）
- 任何 W1 範圍檔案、Lerna.html、netlify.toml、vercel.json

## Schema（zod）

```ts
// types/session.ts
export const SessionSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime().nullable(),
  durationSec: z.number().int().nonnegative(),
  subject: z.string().max(120).nullable(),
  tags: z.array(z.string().max(40)).max(20),
  notes: z.string().max(2000).nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
})
export type Session = z.infer<typeof SessionSchema>

// 建立時 client 只給這幾個（其他由 server 補）
export const NewSessionSchema = z.object({
  startedAt: z.string().datetime().optional(),
  subject: z.string().max(120).optional(),
  tags: z.array(z.string().max(40)).max(20).optional(),
  notes: z.string().max(2000).optional()
})

// 更新允許這幾個（id / userId / createdAt 不可改）
export const UpdateSessionSchema = z.object({
  endedAt: z.string().datetime().nullable().optional(),
  durationSec: z.number().int().nonnegative().optional(),
  subject: z.string().max(120).nullable().optional(),
  tags: z.array(z.string().max(40)).max(20).optional(),
  notes: z.string().max(2000).nullable().optional()
})
```

## SessionsRepo Interface

```ts
// repositories/sessions-repo.ts
export interface SessionsRepo {
  list(userId: string): Promise<Session[]>
  create(userId: string, input: NewSession): Promise<Session>
  update(userId: string, id: string, input: UpdateSession): Promise<Session | null>  // null = not found or not owned
  delete(userId: string, id: string): Promise<boolean>  // false = not found or not owned
}
```

## In-Memory 實作

- `Map<sessionId, Session>` 為 store
- `create` 用 `crypto.randomUUID()` 產 id；createdAt/updatedAt 用 `new Date().toISOString()`
- `list` 過濾 `s.userId === userId`
- `update` 先 get，檢查 `s.userId === userId`，不符回 null
- `delete` 同樣檢查 ownership
- **匯出單例 `inMemorySessionsRepo`**，routes/sessions.ts 直接用；W2-T04 換 Drizzle 時改這條 import 即可

## Routes 行為

```
POST /sessions
  body: NewSession
  返回: 201 + Session
  錯誤: 400 invalid body, 401 no auth (middleware 已處理)

GET /sessions
  返回: 200 + Session[]
  邏輯: repo.list(c.get('user').sub)

PATCH /sessions/:id
  body: UpdateSession
  返回: 200 + Session
  錯誤: 400 invalid body, 404 not found / not owned

DELETE /sessions/:id
  返回: 204 (no body)
  錯誤: 404 not found / not owned
```

## index.ts 變更

在現有的 `/me` 路由區塊**下方**新增（**不改 cors / rate-limit / healthz / me 區塊**）：

```ts
import { sessionsRoute } from './routes/sessions'
// ...

app.use('/sessions', authMiddleware)
app.use('/sessions/*', authMiddleware)
app.route('/sessions', sessionsRoute)
```

## Constraints
- TypeScript strict（與 W2-T01 風格一致）
- routes 用 zod 驗 body，invalid 回 `{ error: 'Invalid request', details: zodError.flatten() }` + 400
- 不引入新 npm 依賴（zod / hono / hono/jwt 已在）
- in-memory repo 在 process restart 後資料消失，**README 註記這是預期**
- repo 不直接使用 c.get('user')；userId 由 route 傳進去（保持 repo 單純）
- crypto.randomUUID() 在 Node 18+ 內建可用，**不要 import 額外 uuid 套件**
- 別在 routes 寫業務邏輯（複雜運算）；目前邏輯簡單，全在 repo 完成

## Acceptance

```powershell
npm run -w services/api typecheck    # 全綠
npm test --workspace services/api    # ≥ 14 case 全綠（先前 7 + 新增 ≥ 7）
```

新增測試至少涵蓋：
1. POST /sessions — 帶 valid token 建立成功，回 201 + 完整 Session
2. POST /sessions — 帶 valid token + invalid body（如 subject 超過 120 字）回 400
3. GET /sessions — A user 看不到 B user 的 sessions
4. PATCH /sessions/:id — 正常更新成功
5. PATCH /sessions/:id — 更新別人的 session 回 404
6. DELETE /sessions/:id — 正常刪除回 204
7. DELETE /sessions/:id — 刪別人的 session 回 404

未授權的 401 由 authMiddleware 已驗，這個 brief **不重複測**（W2-T01 已涵蓋同一條 middleware）。

每個 vitest case 用不同 `userId` 與獨立 `app.request`，**避免共用 in-memory state**：在 sessions.test.ts 開頭 import 一個 `resetSessionsRepo()` helper（in-memory-sessions-repo.ts 也要 export 這個），`beforeEach` 呼叫。

rate-limit 干擾：vitest 7 個 case 已用 fakeTimer + 不同 IP，**新測試也要在 headers 加 `x-forwarded-for` 用獨特 IP（如 `203.0.113.100` 起跳）**，避免與 rate-limit.test.ts 的 IP 撞號。

## Risk
- repo 共用 state 導致測試交叉污染 → 用 `resetSessionsRepo()` + `beforeEach` 解決
- Hono 的 `c.req.valid('json')` 與 `@hono/zod-validator` 整合通常要裝套件；本任務**不裝**，改成手寫 `await c.req.json()` 然後 `Schema.safeParse()`，省一個 dep
- TypeScript 對 `c.set('user', ...)` 的 type 已在 W2-T01 用 `AuthEnv` 解，新 routes 也要 `new Hono<AuthEnv>()`
- in-memory repo restart 失憶 — README 寫清楚

## ChatGPT Router Prompt

```
你是 Codex Local 的 prompt 工程師。任務：給 services/api 加 sessions CRUD（4 個 endpoint）+ in-memory repo + 完整 vitest。請把下面 brief 翻譯成可貼進 Codex CLI 的 prompt，要求：

1. 開頭明列「要新增的檔案」「要修改的檔案」「禁止觸碰的檔案」三段，逐一檔名
2. 給 zod schema 的完整 TypeScript（types/session.ts）
3. 給 SessionsRepo interface 與 in-memory 實作完整內容
4. 給 routes/sessions.ts 完整內容（含 zod safeParse 錯誤處理）
5. 給 index.ts 要插入的 3 行（mount + 2 個 use）— 強調**不改其他區塊**
6. 給 sessions.test.ts 至少 7 case 完整內容（用獨特 x-forwarded-for IP `203.0.113.100`–`109` 避開 rate-limit 干擾）
7. 結尾 2 條使用者驗收指令（typecheck + test）
8. 強調 do-not-touch 清單，特別是 vitest.config.ts / tests/setup.ts / tests/me.test.ts / tests/rate-limit.test.ts / src/middleware/** / src/env.ts / src/routes/healthz.ts / src/routes/me.ts / src/db/**
9. 強調「不要新增 npm 依賴；zod 與 hono 都已存在」
10. 強調「不要動 Lerna.html / netlify.toml / vercel.json」
11. 繁體中文 prose、code 與技術名詞用英文

Brief：
[把 W2-T03 整份 brief 貼進來]
```

## 完成回報模板
```
## W2-T03 完成回報
- [ ] typecheck 綠：[貼最後 5 行]
- [ ] vitest ≥ 14 case 全綠：[貼摘要 Test Files X passed | Tests Y passed]
- [ ] 新增/修改檔案清單：[列]
- [ ] do-not-touch 清單核對（用 git status，確認沒有越界）：[貼 git status --short]
- 偏離 brief 的決策：[列]
- 下一個 brief 建議（W2-T04 候選）：[寫]
```
