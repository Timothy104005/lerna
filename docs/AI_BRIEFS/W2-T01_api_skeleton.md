# W2-T01 — API Skeleton + Auth + /me Endpoint

## Meta
- **task_id**: W2-T01_api_skeleton
- **phase**: W2 後端骨架
- **executor**: Codex Cloud（檔案多、要跑 build & test、長任務）
- **預估工時**: 1–2 天
- **依賴**: W1-T01、W1-T02 完成且 CI 綠

## Goal
在 `services/api/` 建立可運行的 API 服務，包含：
1. 框架選 **Hono**（輕量、跑得了 Node 也跑得了 Cloudflare Workers，未來部署彈性大）
2. 兩條 endpoint：`GET /healthz`（不需 auth）、`GET /me`（需 JWT，回 user payload）
3. Auth 對接 **Supabase Auth**（沿用現有 schema.sql）
4. ORM 用 **Drizzle**（與 Postgres 對接，可跑 migration）
5. 跑得起來：`npm run -w services/api dev` 在 localhost:8787 起服務

## Context Files

**要新增**：
- `services/api/src/index.ts`（Hono app entry）
- `services/api/src/routes/healthz.ts`
- `services/api/src/routes/me.ts`
- `services/api/src/middleware/auth.ts`（驗 Supabase JWT）
- `services/api/src/db/client.ts`（Drizzle + postgres.js）
- `services/api/src/db/schema.ts`（先放 user 表，對應 supabase/schema.sql）
- `services/api/src/env.ts`（用 zod 驗 env）
- `services/api/.env.example`（DATABASE_URL、SUPABASE_URL、SUPABASE_ANON_KEY、SUPABASE_JWT_SECRET）
- `services/api/drizzle.config.ts`
- `services/api/tests/me.test.ts`（vitest）
- `services/api/README.md`

**要修改**：
- `services/api/package.json`（補實際依賴：hono、@hono/node-server、drizzle-orm、postgres、zod、vitest、tsx）
- `services/api/tsconfig.json`（確保 vitest types 可解析）

**禁止觸碰**：
- `supabase/schema.sql`（schema 由 supabase 那邊管，這裡只建 Drizzle 對應）
- `cloud/lerna-cloud-sync.js`（W7-8 才 retire）
- 其他 workspace 的檔案
- 任何 `Lerna*.html`、`YPT++*.html`

## Constraints
- 不寫 Supabase service-role key 進 git；只用 anon key + JWT secret 驗 token
- JWT 驗證用 Supabase 的 HS256（從 SUPABASE_JWT_SECRET 算 HMAC）
- Drizzle schema 先只 map `users` 表（schema.sql 既有），其他表 W7-8 再加
- Auth middleware：缺 token → 401；token 過期 → 401；valid → 把 user payload 塞 `c.set('user', ...)`
- rate limit 先不做（W2-T02 的事）
- CORS：dev 階段允許 `http://localhost:5173`（Vite default）
- 測試用 vitest + supertest 風格；不打真的 Supabase（mock JWT secret 即可）
- 不在這份任務裡部署到 Cloudflare（W10 的事）

## Acceptance
1. `npm install` 後跑 `npm run -w services/api dev` → 8787 port 起服務
2. `curl http://localhost:8787/healthz` → 200 `{"ok":true,"version":"..."}`
3. `curl http://localhost:8787/me` 無 token → 401
4. `curl http://localhost:8787/me -H "Authorization: Bearer <test JWT>"` → 200 `{"id":"...","email":"..."}`
5. `npm run -w services/api test` → 至少 4 個 case 通過：
   - healthz 200
   - me without token 401
   - me with invalid token 401
   - me with valid token 200
6. `npm run -w services/api typecheck` 全綠
7. CI（W1-T02 設定的）對這個 PR 仍綠

## Risk
- **Supabase JWT secret 取得方式**：Supabase Dashboard → Project Settings → API → JWT Secret。Codex 不該猜值；`.env.example` 標 `<從 supabase dashboard 拿>` 即可
- **Drizzle 與 Supabase schema 漂移**：先寫一個 `npm run -w services/api db:introspect` 指令做標記，但本任務不執行
- **Hono 在 Node 與 Workers 行為差異**：本任務只跑 Node（@hono/node-server），Workers 適配是 W10 的事
- **postgres.js 在 Cloudflare Workers 不能用**：未來如果改 Workers 要換成 Hyperdrive + neon serverless；先註記，本任務不處理

## ChatGPT Router Prompt

```
你是 Codex Cloud 的 prompt 工程師。任務範圍橫跨 12+ 個檔案，要建立完整可跑的 Hono API skeleton 含 Supabase JWT 驗證與 Drizzle ORM。請把下面的 brief 翻譯成適合 Codex Cloud 一次性產出的 prompt：

要求：
1. 開頭給「分檔清單」，每個檔案先給用途一句話
2. 接著按檔案順序給完整內容（TypeScript），重點放在：
   - src/index.ts 的 Hono app + middleware 串接
   - middleware/auth.ts 的 JWT 驗證流程（jose 或 hono/jwt）
   - tests/me.test.ts 的 4 個 case
3. package.json 的 scripts: dev / build / typecheck / test / db:introspect
4. README.md 給「本機跑步驟」section
5. 不要寫真實的 secrets，全部從 .env 讀
6. 結尾給驗收指令清單（curl + test 指令）
7. 繁體中文 prose，code 與技術名詞保持英文

Brief：
[把 W2-T01 整份 brief 貼進來]

請告訴我：你會建議用 Codex Cloud 的哪種模式（單次大 prompt vs 多步驟）？
```

## 完成回報模板
```
## W2-T01 完成回報
- 新增/修改檔案：[列表]
- npm run -w services/api dev 輸出（前 20 行）：[貼]
- curl /healthz 結果：[貼]
- curl /me（無 token / 有 token）結果：[各貼]
- npm run -w services/api test 結果：[貼]
- npm run -w services/api typecheck 結果：[貼]
- CI run URL + 狀態：[貼]
- 偏離 brief 的決策：[列]
- 下一個 brief 建議（W2-T02 候選）：[寫]
```
