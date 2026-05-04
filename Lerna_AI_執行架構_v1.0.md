# Lerna 上線執行步驟 + AI 工具協作架構 v1.0

> 文件定位：在既有 `Lerna_重構計劃書_v1.0.pdf`（23 頁，路線／技術選型／預算）與 `Lerna_執行手冊_v1.0.pdf`（25 頁，8 Phase × 12 週逐步驗收）之上，補一份壓縮版執行清單，並把 Claude / ChatGPT / Codex 三套工具串成可運作的 AI 開發鏈。
> 撰稿日：2026-05-02
> 不確定：本文件未逐頁讀完上述兩份 PDF（只抽樣 p1–p8）。若內容衝突以原 PDF 為準。

---

## 1. 客觀現況（已從 `C:\Code\Lerna\` 直接驗證）

| 項目 | 現況 | 來源 |
|---|---|---|
| 主程式 | `Lerna.html`（1.49 MB，原 YPT++ v18 演進版） | 檔案大小 ls 結果 |
| 行動端 | `YPT++ Mobile/` 已用 Capacitor 8.x scaffold Android + iOS | `YPT++ Mobile/package.json` |
| 雲端骨架 | `supabase/schema.sql` 已建表、`cloud/lerna-cloud-sync.js` 已實作同步雛形 | 目錄列表 |
| 部署 | `netlify.toml`、`vercel.json`、`service-worker.js` 已存在 | 根目錄 ls |
| 主要套件 | `@capacitor/* 8.3.0`、`@supabase/supabase-js 2.104.0`、`esbuild 0.28.0` | `package.json` |
| 既有 AI 工作流 | 8 份 `CODEX_PROMPT_*.md`（v21 ai i18n、v22 mobile、v24 class handlers 等）顯示已以 Codex 為執行端 | 根目錄 ls |
| 文件 | 重構計劃書、執行手冊（含 12 週時程）已產出 | 根目錄 PDF |

**缺口**（從計劃書 p4–5 摘錄，標示為「已驗證」內容）：
- 沒有自建 API 後端
- 雲端只能存「整包 state 快照」，無法做欄位級操作
- 沒有正規化資料表、沒有 RLS／rate limit／審計
- 前端是單檔 React，無模組化／無單元測試
- 主域名仍接 Cloudflare 但未接自家 API

不確定：`Lerna.html` 內部模組化程度未實際 grep，技術債顆粒度以執行手冊為準。

---

## 2. 12 週執行清單（壓縮版，與執行手冊 8 Phases 對齊）

| 週 | Phase | 交付 | 驗收 |
|---|---|---|---|
| W1 | 起手式 | monorepo 切分（`apps/web`、`apps/mobile`、`packages/core`、`services/api`）、turbo / pnpm workspaces、CI（GitHub Actions）、`.env` 範本 | `pnpm build` 全綠；CI 跑得動；`.env.example` 完整 |
| W2–3 | 後端骨架 | API 框架（候選：NestJS on Node、Hono on Cloudflare Workers）、Auth（建議續用 Supabase Auth，若要完全自主可換 Auth.js）、ORM（Drizzle）；第一條路徑 `/me`、`/sessions` | Postman 流程跑通；JWT 驗證 OK；rate limit 上線 |
| W4–5 | 前端拆解 | 從 `Lerna.html` 抽模組到 React + Vite，共用 `packages/core` 型別；TanStack Query 接 API；逐步 PWA 遷移 | Lighthouse ≥ 80；首頁 LCP < 2.5s；現有 8 個產品模組行為等價 |
| W6 | 同步核心 | Sync 協定（建議 last-write-wins + 單調版本號或 CRDT）；本地 IndexedDB ↔ 雲端；衝突 UI | 斷網寫入、上線後 merge 成功；`localStorage v6` 鍵能 import |
| W7–8 | 模組後端化 | Focus / Plan / Learn / Stats / Groups / Profile / Settings 全部從 `localStorage` 唯一來源換成 API + 本地快取 | 跨裝置登入後資料一致；E2E 可重播 |
| W9 | Capacitor 對齊 | mobile bundle 接新 API；Native 權限（通知、檔案系統）、Deep Link、Push（FCM／APNs）| Android Debug 跑通；iOS TestFlight 內測通過 |
| W10 | 部署＋觀測 | Cloudflare CDN+WAF、Sentry、PostHog（或 Plausible）、健康檢查、SLO | 儀表板可看；錯誤可追蹤；alert 渠道通 |
| W11 | 金流＋訂閱 | Stripe Checkout（國際）+ entitlement gate；台灣端候選：綠界 / 藍新 / TapPay（待商業面決） | 測試卡可開訂閱；entitlement 即時生效；webhook 不漏單 |
| W12 | 上線前驗收 | Playwright E2E、安全 review、隱私政策、Play Store / App Store 送審 | 200 內測用戶可用、零阻塞 bug |

不確定：Phase 順序與週數沿用重構計劃書建議，未校準個人實際可投入工時。建議跑完 W1 後重新估時。

---

## 3. AI 工具協作架構（核心：你提的 Claude→ChatGPT→Codex 三層）

### 3.1 三層分工

**L1 — Brain（Claude Pro / Cowork mode）— 規劃與審查**
- 強項：長 context、跨檔讀寫、做技術選型、寫驗收條件、code review、衝突仲裁
- 不適合：實際大量改檔（速度／成本不划算）、跑網頁操作
- 輸出：結構化 Task Brief（見 §3.3）+ 每週 diff review

**L2 — Router（ChatGPT Plus 對話框 / GPT‑5 thinking）— Prompt 工程與工具選擇**
- 強項：對 OpenAI 自家工具特性最熟、thinking 模式可反覆校準 prompt、可上網
- 職責：把 L1 Brief 翻譯成最佳 Codex prompt；判斷該丟 Local / Cloud / Agent
- 輸出：可直接貼進 Codex 的 prompt + 預期 diff

**L3 — Executors（執行端）**

| 執行器 | 適合任務 | 為什麼 |
|---|---|---|
| Codex CLI（Local） | ≤ 5 檔的 refactor、UI 微調、bug fix、寫單元測試 | 直接動本地 repo，回饋快，不用上傳 |
| Codex Cloud | monorepo 切分、模組拆解、批量遷移、長任務 | 雲端沙箱、跑得久、PR-style 輸出 |
| ChatGPT Agent mode | Stripe Dashboard 設定、Cloudflare 規則、Play Console 送審、Supabase 後台點按 | 可開瀏覽器執行 GUI 流程 |
| ChatGPT 對話框 | 小段 code、查 API、設計建議 | 不需動 repo 時最輕量 |

### 3.2 單一任務生命週期

```
[你的意圖]
   ↓
[Claude] 讀檔 → 產 Brief（含 goal / files / acceptance / risk）
   ↓  你貼 brief
[ChatGPT 對話框] 判斷工具 + 產 Codex prompt
   ↓  你貼 prompt
[Codex Local / Cloud / Agent] 執行 → diff / PR / 截圖
   ↓  你貼 diff 回 Claude
[Claude] review → 通過 ✅ 或退回 ChatGPT 重 prompt
   ↓
[你] git commit + push
```

### 3.3 Brief 模板（Claude 輸出 → 給 ChatGPT 用）

```yaml
task_id: W2-T03_auth_endpoint
goal: services/api 建立 POST /auth/login，接 Supabase Auth，回 JWT
context_files:
  - services/api/src/auth.ts          # 新檔
  - services/api/src/main.ts          # 要註冊 route
  - packages/core/types/user.ts       # User 型別已存在
constraints:
  - 不引入新 ORM；用 Drizzle
  - JWT 過期 24h；refresh 7d
  - rate limit: 5 req/min/IP
acceptance:
  - curl 範例可登入並回 JWT
  - 單元測試 ≥ 3 case（success / wrong password / rate limit）
  - tsc + eslint 全綠
recommended_executor: Codex Local（檔案範圍小、需跑本機測試）
risk: Supabase service key 絕不能進 git；用 .env.local 並加進 .gitignore
```

### 3.4 工具選擇決策樹

```
任務需要動 repo 檔案？
├─ 否 → 純查詢／設計 → ChatGPT 對話框
└─ 是 → 影響檔案 ≤ 5？
        ├─ 是 → Codex Local
        └─ 否 → 需要跑 CI / 長任務？
                ├─ 是 → Codex Cloud
                └─ 否 → 要點外部 UI（Stripe / Play Console）？
                        ├─ 是 → Agent mode
                        └─ 否 → Codex Local
跨檔語意檢查 / review → 回 Claude
```

### 3.5 Context 同步守則（三工具不共享記憶，是這套架構最大風險）

- 每個 Brief 自帶 `git status` 摘要 + `context_files` 清單
- Codex 改完，diff **一定**回貼 Claude review，不要直接 commit
- 每個 Phase 結束 Claude 產 `HANDOVER_<phase>.md`（你 repo 已有 `HANDOVER_VERIFIED_2026-04-24.md` 的格式可沿用）
- 三套工具的 system prompt 都註明「不確定就標 unknown，不要編」
- 不確定：Cloud Codex / Agent mode 的 token 與任務時長上限會變動，以 OpenAI 官方文件為準（建議每月 spot-check）

---

## 4. 風險與不確定性

| 風險 | 影響 | 緩解 |
|---|---|---|
| 三工具 context 漏接 | 高 | Brief 模板強制帶檔案清單 + diff 回流 |
| `Lerna.html` 拆解難度 | 中-高 | W4-5 工時可能 +50%；先做 spike，再排剩餘週次 |
| 台灣金流選型 | 中 | 不在 AI 能決的範圍；需商業面拍板（綠界 / 藍新 / TapPay） |
| iOS 上架成本與審核時間 | 低-中 | $99/yr + 通常 1-2 週審核；獨立於開發時程 |
| Supabase vs 自建 Auth | 低 | 執行手冊建議續用；若要完全自主換 Auth.js + Postgres，預估 +1–2 週 |
| Codex Cloud / Agent mode 限制變動 | 低 | 每月驗證一次；備援用 Local |

---

## 5. 下一步具體動作

1. 本檔放在 `C:\Code\Lerna\` 與既有兩份 PDF 並列。
2. **W1 起手式**：建議由 Claude 直接做 monorepo 切分 + CI（不經過 ChatGPT），驗證 Claude 端的執行力上限。
3. **W2 第一個 brief**：挑小任務（auth endpoint）跑完整三段鏈（Claude → ChatGPT → Codex Local），驗證流程後再放大。
4. 每週末 Claude 輸出 `weekly_diff_<wk>.md` + 下週 Brief 池，貼回對話保留 context。
5. 不確定點清單建議集中放在 `docs/UNCERTAINTY_LOG.md`，每解決一條就劃掉。

---

## 來源

- `C:\Code\Lerna\README.md`
- `C:\Code\Lerna\package.json`、`YPT++ Mobile/package.json`
- `C:\Code\Lerna\Lerna_重構計劃書_v1.0.pdf`（p1–p8）
- `C:\Code\Lerna\Lerna_執行手冊_v1.0.pdf`（p1–p3）
- `C:\Code\Lerna\supabase/`、`cloud/`、`scripts/`、`docs/` 目錄列表
- `C:\Code\Lerna\HANDOVER_VERIFIED_2026-04-24.md`
- 現有 `CODEX_PROMPT_*.md` 8 份（顯示既有 Codex 工作流）

OpenAI 工具能力（Local / Cloud Codex、Agent mode）為使用者口述，未在本份逐項對 OpenAI 官方文件查證。建議第一個任務跑通時順便確認當前限制。
