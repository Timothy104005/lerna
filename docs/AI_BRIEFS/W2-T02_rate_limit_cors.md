# W2-T02 — Rate Limit + CORS 強化

## Meta
- **task_id**: W2-T02_rate_limit_cors
- **phase**: W2 後端骨架
- **executor**: Codex Local（檔案 ≤ 5、需跑本機 vitest）
- **預估工時**: 0.5 天
- **依賴**: W2-T01 vitest 4 case 全綠（**未過勿啟動**）

## Goal
在 `services/api` 加上：
1. 全域 IP-based rate limit（預設 60 req / min / IP）
2. 把 CORS origin 從 hardcoded `http://localhost:5173` 改成 env 驅動，dev 與 prod 可分別設
3. 對應的 vitest case

## Context Files

**要新增**：
- `services/api/src/middleware/rate-limit.ts`
- `services/api/src/middleware/cors.ts`（從 `src/index.ts` 抽出，集中管理）
- `services/api/tests/rate-limit.test.ts`

**要修改**：
- `services/api/src/index.ts`（換成新的 cors / rate-limit middleware import）
- `services/api/src/env.ts`（加 `CORS_ORIGINS` env，逗號分隔字串，default `http://localhost:5173`）
- `services/api/.env.example`（加 `CORS_ORIGINS=...`）
- `services/api/package.json`（加 `hono-rate-limiter` 依賴；不要其他新 dep）

**禁止觸碰**：
- `src/middleware/auth.ts`、`src/routes/**`、`src/db/**`、`src/env.ts` 之外的部分
- `tests/me.test.ts`、`tests/setup.ts`、`vitest.config.ts`
- 任何 W1 範圍的檔案（root package.json、ci.yml、turbo.json 等）

## Constraints
- Rate limit：`hono-rate-limiter` package（npm 上活躍維護）；windowMs 60 * 1000、limit 60、`keyGenerator` 用 `c.req.header('x-forwarded-for') ?? 'unknown'`（之後上 Cloudflare 接 `cf-connecting-ip`）
- 超過配額回 429 + `{ error: 'Too Many Requests' }`
- 不對 `/healthz` 套 rate limit（健康檢查不算）
- CORS：parse `CORS_ORIGINS` 逗號分隔字串為陣列；test 環境固定用 `['http://localhost:5173']`；preflight OPTIONS 200
- 測試用 vitest 的 fake timer 或同步發 N+1 個 request 確認第 N+1 個拿到 429
- 不打真實 Supabase 或 DB
- 程式碼 strict TypeScript（與既有風格一致）
- 不在這份任務裡做 per-user rate limit（只 per-IP）；之後 W3+ 加 token bucket 再說

## Acceptance
1. `npm run -w services/api typecheck` 全綠
2. `npm run -w services/api test` 至少 6 個 case 全綠：
   - 既有 4 case（healthz / me 三種）續通過
   - 新增至少 2 case：第 61 次 request 回 429；CORS 正確帶 origin header
3. `curl http://localhost:8787/healthz` 連續打 100 次仍 200（healthz 不限制）
4. `curl http://localhost:8787/me -H "Origin: http://evil.example.com"` 拿不到 CORS header
5. 啟動 `npm run -w services/api dev`，console 印 `API listening on http://localhost:8787`，無 error

## Risk
- `hono-rate-limiter` 的 keyGenerator 在 Hono v4 的 type 可能微妙；如果 type error 太多就降為自寫一個 in-memory Map（標註要在 W10 換成 Cloudflare Durable Object）
- CORS_ORIGINS 在 prod 多個域名時容易設錯；`.env.example` 註解寫清楚 `CORS_ORIGINS=https://lerna.app,https://www.lerna.app`
- vitest 跑 rate limit 測試時，60 次請求要在 60 秒 window 內，否則 fake timer 失準；建議用 vi.useFakeTimers() 或把 limit 設 small (e.g. 5) 讓測試快

## ChatGPT Router Prompt

```
你是 Codex Local 的 prompt 工程師。任務是給 services/api 加 rate limit + 環境驅動 CORS，附 vitest。請把下面 brief 翻譯成可貼進 Codex CLI 的 prompt：

要求：
1. 開頭明列「要新增的檔案」「要修改的檔案」「禁止觸碰的檔案」三段
2. 每個檔案先給用途一句話，再給完整 TypeScript（不用 patch）
3. 注意 import 路徑用相對路徑、ESM 風格
4. tests 給至少 2 個新 case 的完整內容（用 vitest 的 fake timer）
5. 結尾附 4 條使用者驗收指令（PowerShell）
6. 強調「不要動 vitest.config.ts、tests/setup.ts、tests/me.test.ts」
7. 繁體中文 prose、code 與技術名詞用英文

Brief：
[把 W2-T02 整份 brief 貼進來]
```

## 完成回報模板
```
## W2-T02 完成回報
- [ ] typecheck 綠：[貼 5 行]
- [ ] vitest ≥ 6 case 通過：[貼摘要]
- [ ] /healthz 100 次無限：[貼第 100 次 status]
- [ ] /me 帶 evil origin 沒 CORS header：[貼 response header]
- [ ] dev server 起得了：[貼 console 第一行]
- 偏離：[列]
- 下一個 brief 建議（W2-T03 候選）：[寫]
```
