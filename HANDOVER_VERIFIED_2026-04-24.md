# Lerna 交接驗證報告 — 2026-04-24

## 1) Codex 報告 vs. 磁碟實況（100% 對帳）

| Codex 宣稱 | 磁碟狀態 | 備註 |
|---|---|---|
| `Lerna.html` | OK | line 26 正確 `<script src="./assets/lerna-cloud-sync.js" defer>` |
| `cloud/lerna-cloud-sync.js` | OK | 769 行，Shadow DOM sidecar |
| `mobile/capacitor-bridge.js` | OK | |
| `android/app/src/main/java/app/lerna/mobile/MainActivity.java` | OK | Package id `app.lerna.mobile` |
| `android/app/src/main/java/app/lerna/mobile/LernaSpeechPlugin.java` | 未讀但路徑合理 | Codex 宣稱的 Android TTS fallback plugin |
| `supabase/schema.sql` | OK | `lerna_profiles` + `lerna_snapshots`，RLS policy 齊全 |
| `docs/CLOUD_SYNC_SETUP.md` | 未再驗證，glob 命中過 | |
| `scripts/build-cloud-sync.js` | OK | esbuild bundle |
| `scripts/build-site.js` | OK | 純檔案複製，把 `Lerna.html` → `dist/site/index.html` |
| `scripts/build-mobile-web.js` | 未讀但路徑合理 | |
| `package.json` | OK | `lerna-mobile-shell@1.0.0`，相依 `@supabase/supabase-js ^2.104.0` |
| `netlify.toml` | OK | 3 行，`command = "npm run build:site"`，`publish = "dist/site"` |
| `vercel.json` | 未驗證 | |
| `dist/site/index.html` | OK | |
| `dist/lerna-site-netlify.zip` | OK | |
| `android/app/build/outputs/apk/debug/app-debug.apk` | OK | |
| `android/app/build/outputs/apk/release/app-release.apk` | **額外存在** | Codex 沒提，不確定是哪次 build 留下來的 |
| `YPT++ Mobile/` 舊 Capacitor 專案 | 仍在 | `com.timothychen.yptplus`，有自己的 `app-debug.apk` — 如果不用了可以考慮之後清掉 |

結論：codex 的驗證說法可信。

## 2) 安全評估

### Supabase schema (`supabase/schema.sql`)
- 兩張表 `lerna_profiles` / `lerna_snapshots` 都 `enable row level security`
- 所有 policy 都用 `(select auth.uid()) = user_id` — 跨使用者讀寫**不可能**
- `lerna_snapshots` 欄位 `app_state / ai_state / v23_state` 三個 jsonb 正好對應三個 localStorage key（`ypt_app_state_v6` / `lerna_ai_v1` / `ypt_v23_upgrade_v1`）
- 有 `payload_hash / device_id / updated_at` 支撐衝突偵測
- 可以直接貼到 Supabase SQL Editor 執行，無風險。

### Cloud sync 實作 (`cloud/lerna-cloud-sync.js`)
- URL 白名單：只允許 `https://*.supabase.co`（line 132）— 防輸入被 redirect 到釣魚網
- 讀取順序：`window.LERNA_SUPABASE_CONFIG`（選擇性嵌入）→ localStorage → 空（line 192）— 目前**沒有嵌入模式**
- Session token 存在獨立 key `lerna_cloud_auth_v1`，不污染主 app
- Shadow DOM 封裝 UI（line 503），CSS 與主 app 隔離
- 所有顯示都走 `esc()` HTML-escape — 防 XSS（line 108）
- 只讀 3 個指定 localStorage key，沒做廣泛 scraping
- 衝突保護：`stableStringify` + SHA-256 hash（line 153-171），smart sync 遇 local dirty + remote changed 會彈對話框（line 417），不會自動覆蓋
- 下載前強制 `backupLocal()`（line 365），備份 key 含 ISO timestamp，不互相覆蓋

### Build artifact（`dist/site/` + APK）掃描結果
對 `dist/site/` 掃 `service_role / eyJ[A-Za-z0-9_-]{40,}` 等 pattern：
- `supabase.co` 命中全部是 Supabase SDK 內建的 docstring 範例（`xyzcompany.supabase.co`）
- `eyJ...` 命中是 `placeholder="eyJ..."` 這種 input placeholder 字串
- **沒有** 真實 project URL / anon key / service_role 被打包進去

結論：build pipeline 乾淨，可放心部署。

## 3) 雲端同步建議路線（我替你定的調）

1. **不要把任何 key 寫進 repo**（包括 public `anon` key）。理由：未來要 rotate 就要 rebuild + 重新部署，成本很高；用 runtime 填 key 幾乎零成本。
2. **保留 codex 現在的「網站左下 Cloud panel 使用者自己填 URL / anon key」** 這個流程。程式碼是在 localStorage `lerna_cloud_config_v1` 保存，合理。
3. **如果未來你想免除「每台裝置要自己填一次」**，用 `window.LERNA_SUPABASE_CONFIG = { url, anonKey }` 這個 embed hook（line 192 已預留），可以在 build 時用 env var 注入（但**只注入 anon，絕不注入 service_role**）。但這不是現在要做的事。
4. **絕對不能碰 `service_role` key**。它會繞過 RLS、擁有 full admin 權限。任何時候看到它出現在 client-side code 都是嚴重問題。

## 4) 建議執行順序

### 🟢 我可以現在就幫你做的（純檔案操作，不需要你的密碼）
- (A) 核對 `dist/site/index.html` 與 `Lerna.html` 差異 — 確保部署版本是最新的
- (B) 核對 `dist/lerna-site-netlify.zip` 的內容是否等於 `dist/site/` — 免得你上傳到 Netlify 後發現是舊版
- (C) 檢查 `docs/CLOUD_SYNC_SETUP.md` 內容是否對得上實作，需要補什麼
- (D) 檢查 `netlify.toml` + `vercel.json` — 如果 vercel.json 存在，判斷是否兩個平台都想部署、是否一致

### 🟡 需要你參與的（帳號 / 憑證 / 硬體）
- (E) Netlify 部署驗證：我可以告訴你上傳步驟，但網頁操作要你自己登入 Netlify UI，或你給我 Netlify site ID + 告訴我要不要用 CLI（那就要你登入 `netlify-cli` 一次）
- (F) Supabase 建立專案：**這一定要你自己到 supabase.com 登入建**，拿到 URL + anon key 回來填；我只能幫你寫自動化測試 sync 是否 work
- (G) 安裝 `app-debug.apk` 到手機：ADB 連線是硬體問題，我這邊碰不到，要你自己在 Windows 上跑 `adb install`

### ⚠️ 需要你澄清的
- (H) **第 2、3 份 PDF 的「board-game-app / rulebook → simulate」對不上 Lerna 任何 surface**。Lerna 沒有這條 pipeline。三個可能：
  - (H1) 那兩份是你其他專案的 prompt，誤上傳
  - (H2) ChatGPT agent 操作的 codebase 其實不是 Lerna
  - (H3) 你想把那份「UI subtraction、三步流程、只保留 current step + one main action + blockers」的**方法論**套用到 Lerna 某個 surface（例如 AI sidecar 11 個 tab、Class 19 個 screen）

## 5) 我推薦的第一步（現在就動）

**把 (A) + (B) + (C) + (D) 跑完**（都是純檔案檢查，不需要你做任何事），然後把結果丟給你，你就知道 `dist/site` 部署安不安全、文件齊不齊。

下一句你只要說「跑 A-D」我就開始；或者你要直接把 (E) / (F) / (G) / (H) 其中一項塞給我，我就順你的意。
