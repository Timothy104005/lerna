# W1-T01 — Monorepo Scaffold（不動現有 app）

## Meta
- **task_id**: W1-T01_monorepo_scaffold
- **phase**: W1 起手式
- **executor**: Codex Local（範圍小、檔案少、需跑本機）
- **預估工時**: 0.5–1 天
- **依賴**: 無

## Goal
在 `C:\Code\Lerna\` 加上 `apps/`、`services/`、`packages/` 三層 monorepo 結構，設定 npm workspaces + turborepo，**不動現有任何檔案**，讓 `Lerna.html`、Capacitor、Supabase 工作流維持可用。

## Context Files

**要新增**：
- `apps/web/package.json`（空殼 React + Vite 專案，先放 stub）
- `apps/mobile/package.json`（先放 stub，W9 才接 Capacitor）
- `services/api/package.json`（stub）
- `packages/core/package.json`（stub，存共用型別）
- `turbo.json`
- `tsconfig.base.json`
- 各 workspace 的 `tsconfig.json`（extends base）
- `.npmrc`（設 `engine-strict=true`）

**要修改**：
- `package.json`（root）：加 `"workspaces": ["apps/*", "services/*", "packages/*"]`，加 turbo dev script

**禁止觸碰**：
- `Lerna.html`、`YPT++*.html`（任何 v1–v24）
- `YPT++ Mobile/` 整個資料夾（這是舊 mobile 殼，W9 才動）
- `supabase/schema.sql`、`cloud/lerna-cloud-sync.js`
- `scripts/build-*.js`、`netlify.toml`、`vercel.json`
- 既有的 capacitor scripts（`android:*`）

## Constraints
- 套件管理：**npm workspaces**（保留現有 package-lock.json，不換 pnpm）
- 任務 runner：**turborepo**（`turbo@^2`）
- 各 workspace 的 package.json 用 `"private": true`，name 用 `@lerna/*` 命名空間
- TypeScript：strict mode、ES2022 target、moduleResolution: bundler
- 不裝 React / Vite / Hono 等實際依賴（先只放 scaffold；W2 / W4 才裝）
- 不跑 `npm install`（讓使用者最後決定何時跑）
- 不寫任何 .env 真實值

## Acceptance
1. `git status` 顯示新增檔案、root `package.json` 有改動，無其他檔案被動到
2. 新增的 workspace 目錄結構：
   ```
   apps/
     web/{package.json, tsconfig.json, README.md, src/index.ts (空 export)}
     mobile/{package.json, tsconfig.json, README.md}
   services/
     api/{package.json, tsconfig.json, README.md, src/index.ts}
   packages/
     core/{package.json, tsconfig.json, README.md, src/index.ts}
   turbo.json
   tsconfig.base.json
   .npmrc
   ```
3. 各 workspace 的 README.md 寫一句「這是 W4/W2/... 才會填上的內容」
4. 執行 `npm run android:doctor`（既有 script）仍可正常運行（不被新 workspaces 設定弄壞）
5. 執行 `npx turbo run build --dry` 不報錯

## Risk
- **root `package.json` 加 workspaces 後可能讓 capacitor 裝套件路徑改變** → 緩解：root 自己也是個合法 workspace（不在 workspaces glob 裡），既有 dependencies 不動
- **`YPT++ Mobile/` 內有自己的 package.json** → 不要把它納入 workspaces glob，避免雙 capacitor 衝突
- **既有 `node_modules/` 已存在** → 不要刪、不要重 install

## ChatGPT Router Prompt（直接貼進 ChatGPT 對話框）

```
你是 Codex Local 的 prompt 工程師。我給你一份 Lerna 專案的 task brief，請把它翻譯成可以直接貼進 Codex CLI（本地）的 prompt。要求：

1. 開頭明確列出「要動的檔案」「禁止觸碰的檔案」
2. 用 bullet 寫出每個新檔案要包含的內容（package.json 的 name / scripts / 依賴版本）
3. 給具體的 turbo.json / tsconfig.base.json 建議內容（用程式碼區塊）
4. 結尾附驗收指令（指令使用者貼進 PowerShell 跑）
5. 用繁體中文，技術名詞保持英文
6. 不要產生實際 package install 指令

Brief 內容：
[把上面 W1-T01 整份 brief 貼進來]

請先給 Codex prompt，再附一段「使用者驗收 checklist」。
```

## 跑完後請回貼這份模板給 Claude
```
## W1-T01 完成回報
- git status 輸出：
  ```
  [貼這裡]
  ```
- npx turbo run build --dry 輸出：
  ```
  [貼這裡]
  ```
- 新增檔案清單：
  - [...]
- 任何偏離 brief 的決策：
  - [...]
- 預期問題：
  - [...]
```
