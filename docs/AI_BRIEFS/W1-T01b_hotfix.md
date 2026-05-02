# W1-T01b — W1 Hotfix（修 P0 阻斷）

## Meta
- **task_id**: W1-T01b_hotfix
- **phase**: W1 起手式（修復回合）
- **executor**: Codex Local
- **預估工時**: 0.5–1 小時
- **依賴**: 上一次 W1-T01 / W1-T02 已產生的檔案

## Goal
修掉上次驗收找出的 4 個 P0 + 6 個 P1，讓 W1 真的能通過 acceptance。本任務**只修現有檔案**，不新增 monorepo 結構。

## P0 必修

### 1. `package.json` 截斷修復
現況：root `package.json` 在 byte 1974 處停在 `"@supabase/supabase-js": "^2.1`，沒有閉引號、沒有 `}`。
動作：
- 補回 `"@supabase/supabase-js": "^2.104.0"`（這是上一版的版本）
- 補回缺失的閉合 `"`、`}`、`}`、`}`
- 跑 `node -e "JSON.parse(require('fs').readFileSync('package.json','utf8'))"` 確認無誤

預期最終 dependencies 區塊：
```json
"dependencies": {
  "@capacitor/android": "^8.3.0",
  "@capacitor/app": "^8.1.0",
  "@capacitor/core": "^8.3.0",
  "@capacitor/filesystem": "^8.1.2",
  "@capacitor/share": "^8.0.1",
  "@capacitor/splash-screen": "^8.0.1",
  "@capacitor/status-bar": "^8.0.2",
  "@supabase/supabase-js": "^2.104.0"
},
"devDependencies": {
  "@capacitor/assets": "^3.0.5",
  "@capacitor/cli": "^8.3.0",
  "esbuild": "^0.28.0"
}
```
（保留 W1-T01 加的 `workspaces` 與 `dev`/`build` scripts）

### 2. CI 換回 npm（不用 pnpm）
動作：把 `.github/workflows/ci.yml` **整個重寫**：
- 移除 corepack / pnpm / pnpm-lock.yaml 相關 step
- 用 `actions/setup-node@v4` 的 `cache: 'npm'`
- 用 `npm ci`（不是 `pnpm install`）

### 3. CI 拆三個並行 job
動作：`ci.yml` 三個 job：`typecheck`、`lint`、`build`，全跑 ubuntu-latest、Node 20，全部不加 `continue-on-error`。每個 job 各自 `npm ci` + 各自 turbo 指令：
```yaml
jobs:
  typecheck:
    ...
    - run: npm ci
    - run: npx turbo run typecheck
  lint:
    ...
    - run: npm ci
    - run: npx turbo run lint
  build:
    ...
    - run: npm ci
    - run: npx turbo run build
```

### 4. 補 lint scripts + turbo lint task
動作：
- 四個 workspace（`apps/web`, `apps/mobile`, `services/api`, `packages/core`）的 `package.json` 都加 `"lint": "echo \"lint stub: eslint will be added in W3\""`（W3 才裝 eslint，避免現在 install 拖慢）
- `turbo.json` 加 `"lint": { "outputs": [] }` task
- `turbo.json` 順手加 `"test": { "outputs": [], "dependsOn": ["^build"] }`，給 W2-T01 vitest 用

## P1 必修

### 5. Node 版本對齊
`ci.yml` 用 `node-version: 20`（不是 22）。

### 6. 移除無用 artifact upload
`ci.yml` build job 不要 upload `apps/web/dist/site/`（W4 才有東西）；本回合先刪掉這個 step。

### 7. 清掉 stray 檔案
- 刪除 `.tmp_w1_test/`（空目錄）
- 刪除 `scripts_w1/`（整個資料夾，含 `bootstrap.ps1`）
- 理由：bootstrap.ps1 想做 `git mv` 搬檔，違反 brief「不動現有任何檔案」原則

### 8. 修 git index
動作：
```powershell
Remove-Item .git/index*.lock -Force -ErrorAction SilentlyContinue
git reset
# 若 reset 失敗：
# Copy-Item .git/index .git/index.bak
# git read-tree HEAD
```
驗證 `git status` 可以正常輸出。

### 9. `.gitignore` 補丁
在現有 `.gitignore` 末尾加：
```
# Monorepo runtime
.turbo/
services/api/.env
services/api/dist/
apps/*/dist/
packages/*/dist/
```

### 10. 不修這些（保留）
- `services/api/src/**`（程式碼質量已通過 review）
- `tsconfig.base.json`、`turbo.json` 已存在的 dev/build/typecheck task（只新增、不重寫）

## Acceptance
跑這些指令，**全部要綠**：
1. `node -e "JSON.parse(require('fs').readFileSync('package.json','utf8')); console.log('OK')"` → `OK`
2. `git status` → 不報 `index file corrupt`
3. `npm install` → 完成（不要 `--frozen-lockfile`，因 lockfile 可能要更新）
4. `npx turbo run typecheck` → 全綠（stub 都 echo）
5. `npx turbo run lint` → 全綠（stub 都 echo）
6. `npx turbo run build` → 全綠（stub 都 echo）
7. `ls .tmp_w1_test scripts_w1 2>$null` → 兩個都不存在
8. `cd services/api && npm test` → 4 個 vitest case 通過（rollup native 缺檔的話跟著做：刪 root `node_modules` 與 `package-lock.json` 重 `npm install`）

## Risk
- 重 `npm install` 會更新 lockfile，commit 前確認 diff 只動 deps 不動 capacitor 主要 lock chain
- rollup native module 問題若 `npm install` 後仍在，可手動 `npm install @rollup/rollup-linux-x64-gnu @rollup/rollup-darwin-arm64 @rollup/rollup-win32-x64-msvc --save-optional`（看作業系統）

## ChatGPT Router Prompt
```
你是 Codex Local 的 prompt 工程師。下面這份 brief 是上一輪 W1 的 hotfix。請翻譯成可貼進 Codex CLI 的 prompt，要求：
1. 開頭明列「要修的檔案」與「要刪的檔案/資料夾」
2. 修 package.json 的部分，給完整的 JSON 內容（不是 patch）
3. 重寫 ci.yml 給完整 YAML
4. 各 workspace package.json 的 lint script 補丁，明確列每個檔案路徑
5. 結尾附「使用者驗收 checklist」共 8 條（PowerShell 指令）
6. 繁體中文 prose、code/技術名詞用英文
7. 強調「不要動 services/api/src/**、不要動 W1-T01 的目錄結構」

Brief：
[把 W1-T01b 整份 brief 貼進來]
```

## 完成回報模板
```
## W1-T01b 完成回報
- [ ] package.json JSON.parse OK
- [ ] git status 正常
- [ ] npm install 成功，lockfile diff：[貼]
- [ ] turbo typecheck/lint/build 全綠：[貼輸出]
- [ ] services/api 4 test 通過：[貼輸出]
- [ ] .tmp_w1_test / scripts_w1 已刪
- [ ] .gitignore 已補
- [ ] CI 三個 job push 後全綠 URL：[貼]
- 偏離：[列]
```
