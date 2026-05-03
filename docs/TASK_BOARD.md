# Lerna 任務看板

> 一頁式進度表。每完成一條，把 `[ ]` 改 `[x]`，並在「最近回合」記下 commit hash。

## 角色與責任
- **L1 Brain（Claude）** — 寫 brief、review diff、做技術選型仲裁
- **L2 Router（ChatGPT 對話框）** — 翻譯 brief → Codex prompt、判斷哪個執行器
- **L3 Executor（Codex Local / Cloud / Agent）** — 真正改檔
- **使用者（你）** — 在三者間搬運訊息、最後 commit

## 當前狀態
- **本週**: W3 完 ✅ → 接 W4 前端拆解
- **執行中**: 無；W3 全部 push 上 origin
- **下一個 brief**: W4-T01 從 Lerna.html 抽模組到 apps/web（先 grep Lerna.html 場勘再寫 brief）

## W1 起手式 ✅
- [x] **W1-T01** monorepo scaffold — Codex Local + Claude 補修
- [x] **W1-T02** GitHub Actions CI — Claude 直接重寫（npm + Node 20 + 三 job）— 待第一次 push 後觀察
- [x] **W1-T01b** hotfix — Claude 接手完成
- [ ] 退回 Codex 越界改的檔：`git checkout -- Lerna.html netlify.toml vercel.json` + 刪 `lernav1.0.html / lernav1.1.html`
- [ ] W1 retro：完成 — 結論「brief 越長 Codex 越會偷殺檔；下一輪 brief 結尾加強 dont-touch 清單」

## W2 後端骨架
- [x] **W2-T01** API skeleton + /me — vitest 4 case 全綠
- [x] **W2-T02** rate limit + CORS — vitest 3 case 全綠
- [x] **W2-T03** sessions CRUD（in-memory repo）— vitest 7 case 全綠（總計 14/14）
- [x] **W2-T04** Drizzle Postgres repo + Supabase migration — vitest 5 case 全綠（總計 19/19）
- [ ] **W2-T05** 真 Postgres / integration test — **跳序到 W10**（部署前再做）

## W3 觀測性
- [x] **W3-T01** OpenAPI spec + Swagger UI — vitest 19/19 全綠，/openapi.json 200、/docs 200
- [x] **W3-T02** logging + request id — vitest 19/19 全綠，pino test silent / dev pretty / prod JSON
- [x] **W3-T03** 統一錯誤格式（problem+json）— vitest 19/19 全綠，所有 4xx / 429 走 application/problem+json + RFC 7807 shape

## W4-5 前端拆解（待規劃 brief）
- [ ] 子任務先行記下：W4 拆出 apps/web 後，要更新 `netlify.toml` 與 `vercel.json` 的 buildCommand / outputDirectory 指向 monorepo 路徑（用 npm 不用 pnpm；Node 20）。Codex 在 W1 自作主張先改了一版，已退回。

## W6 同步核心（待規劃 brief）

## W7-8 模組後端化（待規劃 brief）

## W9 Capacitor 對齊（待規劃 brief）

## W10 部署 + 觀測（待規劃 brief）

## W11 金流（待規劃 brief，需商業面決策）

## W12 上線驗收（待規劃 brief）

---

## 最近回合
| 日期 | task | 結果 | commit | 備註 |
|---|---|---|---|---|
| 2026-05-02 | 啟動 | brief 產出（W1-T01 / T02、W2-T01）| — | Claude 寫 brief，ChatGPT/Codex 還沒接手 |
| 2026-05-02 | W1 第一回 | Codex 跑完三 brief，Claude 驗收：4 個 P0 + 6 個 P1 | — | package.json 截斷、CI 用錯 pnpm、無 lint、stray 檔案；發回 hotfix W1-T01b |
| 2026-05-02 | W1-T01b hotfix 第一回 | Codex 只修了 root package.json + .gitignore；ci.yml/turbo.json/4 個 workspace 沒動，services/api 反而 regression 把 W2-T01 deps 清空 | — | Claude 直接接手重寫 6 個檔案，剩下刪檔/git index 由 `scripts/w1_cleanup.ps1` 處理 |
| 2026-05-02 | W2-T01 vitest 第一回 | 4 case 全紅，`app` undefined | — | Claude 修 vitest.config + setup file + 改 static import，仍紅 |
| 2026-05-02 | W2-T01 根因 | Read 發現 src/index.ts 被洗成 `export {};` —Codex hotfix regression #2 | — | Claude 還原 src/index.ts；W2-T02 brief 已寫好等 W2-T01 過後放行 |
| 2026-05-02 | W2-T01 + W2-T02 收尾 | vitest 7/7 全綠、typecheck 無 error、npm install OK | — | 待清違規檔 + commit；W2-T03 brief 寫了 |
| 2026-05-02 | W2-T03 收尾 | vitest 14/14 全綠、Codex 沒亂殺檔（do-not-touch 清單奏效）| 4 commits ahead of origin | 違規檔已退回；root .env.example 待 track |
| 2026-05-02 | W2-T04 收尾 | vitest 19/19 全綠、do-not-touch 清單 13 檔奏效 | — | Drizzle repo + Supabase migration；default env 仍 in-memory |
| 2026-05-03 | W3 接班 | Handover 讀畢、W3-T01 OpenAPI brief 已產出 | — | do-not-touch 清單 ~25 檔；新 dep 限 @hono/zod-openapi + @hono/swagger-ui |
| 2026-05-03 | W3-T01 收尾 | vitest 19/19、typecheck 綠、/openapi.json + /docs 200；Codex 把 auth `app.use('/sessions/:id?')` 簡化成單行 optional segment（vitest 沒 cover 到 401，prod bypass 風險），Claude 直接改回兩行 | — | 教訓：Codex 「簡化 path」要當紅旗看；auth path 不准 optional segment，請見 memory 記錄 |
| 2026-05-03 | W3-T01 push | feat OpenAPI commit + Claude auth fix commit | 7ca654a / 59b4598 | 兩 commit 順序反了（PowerShell backtick + lock 路徑寫錯造成第一次 commit 失敗）；history fix 在 feat 前但不影響功能 |
| 2026-05-03 | W3-T02 收尾 | vitest 19/19、typecheck 綠、stdout 無 pino 噪音；Codex 沒偷殺、auth 4 行守住、index.ts 只多 4 行 | 974712e | pino test silent / dev pretty / prod JSON；request-id middleware 用 module augmentation 進 ContextVariableMap |
| 2026-05-03 | W3-T03 收尾 | vitest 19/19、typecheck 綠、/openapi.json 含 Problem + ValidationProblem schemas；Codex 滿分（沒偷殺、偏離 brief 三個決策都合理且 brief Risk 段已預測） | 7e19001 | 用 `new Response` 直接 set Content-Type（c.json 會 overwrite）；hono-rate-limiter 0.5.3 原生 handler hook |

## 不確定性 log
| 不確定點 | 何時要解 | 負責人 |
|---|---|---|
| Lerna.html 內部模組化程度 | W4 開始前 | Claude（grep） |
| 台灣金流選型 | W11 開始前 | 使用者商業面 |
| Codex Cloud 任務時長/檔案數上限 | W2-T01 跑完即知 | 使用者驗證 |
| Hono on Cloudflare Workers vs Node | W10 部署時 | Claude |
