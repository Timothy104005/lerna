# Lerna 任務看板

> 一頁式進度表。每完成一條，把 `[ ]` 改 `[x]`，並在「最近回合」記下 commit hash。

## 角色與責任
- **L1 Brain（Claude）** — 寫 brief、review diff、做技術選型仲裁
- **L2 Router（ChatGPT 對話框）** — 翻譯 brief → Codex prompt、判斷哪個執行器
- **L3 Executor（Codex Local / Cloud / Agent）** — 真正改檔
- **使用者（你）** — 在三者間搬運訊息、最後 commit

## 當前狀態
- **本週**: W1（起手式）
- **執行中**: 無（等使用者啟動 W1-T01）
- **下一個 brief**: W1-T01 → W1-T02 → W2-T01（嚴格順序）

## W1 起手式 ✅
- [x] **W1-T01** monorepo scaffold — Codex Local + Claude 補修
- [x] **W1-T02** GitHub Actions CI — Claude 直接重寫（npm + Node 20 + 三 job）— 待第一次 push 後觀察
- [x] **W1-T01b** hotfix — Claude 接手完成
- [ ] 退回 Codex 越界改的檔：`git checkout -- Lerna.html netlify.toml vercel.json` + 刪 `lernav1.0.html / lernav1.1.html`
- [ ] W1 retro：完成 — 結論「brief 越長 Codex 越會偷殺檔；下一輪 brief 結尾加強 dont-touch 清單」

## W2 後端骨架
- [x] **W2-T01** API skeleton + /me — vitest 4 case 全綠
- [x] **W2-T02** rate limit + CORS — vitest 3 case 全綠
- [ ] **W2-T03** sessions endpoint（CRUD，先用 in-memory repo）— `docs/AI_BRIEFS/W2-T03_sessions_endpoints.md` — Codex Local
- [ ] W2-T04 Drizzle migration + 接真 Postgres（把 in-memory repo 換掉）（待 brief）

## W3 後端骨架（續）
- [ ] W3-T01 OpenAPI spec 自動生成（待 brief）
- [ ] W3-T02 logging + request id（待 brief）

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

## 不確定性 log
| 不確定點 | 何時要解 | 負責人 |
|---|---|---|
| Lerna.html 內部模組化程度 | W4 開始前 | Claude（grep） |
| 台灣金流選型 | W11 開始前 | 使用者商業面 |
| Codex Cloud 任務時長/檔案數上限 | W2-T01 跑完即知 | 使用者驗證 |
| Hono on Cloudflare Workers vs Node | W10 部署時 | Claude |
