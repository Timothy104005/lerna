# W1-T02 — GitHub Actions CI Pipeline

## Meta
- **task_id**: W1-T02_ci_pipeline
- **phase**: W1 起手式
- **executor**: Codex Local
- **預估工時**: 0.5 天
- **依賴**: W1-T01 已完成（monorepo 結構存在）

## Goal
建立 `.github/workflows/ci.yml`，在 push 與 pull request 時自動跑 install / typecheck / lint / build，產生綠色徽章，讓後續 W2+ 任務有回饋迴路。

## Context Files

**要新增**：
- `.github/workflows/ci.yml`
- `.github/workflows/README.md`（解釋每個 job）
- 各 workspace 的 `package.json` 加 `"scripts": { "typecheck": "tsc --noEmit", "lint": "eslint .", "build": "..." }`（先放 echo stub 避免裝 eslint 工具鏈）

**要修改**：
- root `package.json` 加 `"scripts": { "ci:typecheck": "turbo run typecheck", "ci:lint": "turbo run lint", "ci:build": "turbo run build" }`

**禁止觸碰**：
- 既有的 capacitor scripts、`scripts/*.js`、`Lerna.html` 等
- W1-T01 已建立的 workspace 結構（只能在 package.json 加 scripts，不改其他檔）

## Constraints
- Node 版本：**20.x LTS**（與本地 capacitor 相容）
- 觸發：push to `main` / `dev`，PR to `main`
- Cache：用 `actions/setup-node@v4` 的 npm cache
- 不跑 mobile（capacitor）的 build（android:* 指令需 JDK / Android SDK，CI 太重）
- 不跑 e2e（Playwright 第 W12 才上）
- 矩陣只跑 ubuntu-latest（先簡單）
- secrets 不在這份 ci.yml 裡用到（要等 W10）

## Acceptance
1. `.github/workflows/ci.yml` 存在
2. 三個 job：`typecheck`、`lint`、`build`，並行跑
3. 每個 job 的 step：checkout → setup-node → npm ci → 執行對應 turbo 指令
4. 在使用者本機跑 `act -W .github/workflows/ci.yml`（如果有裝 act）或直接 push 一個小 commit 觀察 GitHub Actions tab，全綠
5. README.md 說明：本地除錯時可跑 `npm run ci:typecheck` 等指令
6. 不影響既有 npm scripts

## Risk
- **`npm ci` 需要 lockfile** → 確認 W1-T01 沒動 lockfile；若 lockfile 過舊，CI 會失敗 → 緩解：先在本機 `npm install` 一次再 commit lockfile
- **turbo 第一次跑會產生 `.turbo/` cache** → 加進 .gitignore
- **某 workspace 沒 build script** → turbo 預設遇缺會跳過，但記得 stub 寫 `"echo no build"`

## ChatGPT Router Prompt

```
你是 Codex Local 的 prompt 工程師。任務是寫一份 GitHub Actions CI workflow，跑 typecheck / lint / build 三個 job，並更新各 workspace 的 package.json 加上對應 stub script。

要求：
1. 完整給出 .github/workflows/ci.yml 的 YAML 內容（含 cache、matrix-free、Node 20）
2. 列出所有要修改的 package.json 路徑，每份要加哪些 scripts（明確逐字）
3. 結尾附「使用者本機自測指令」（PowerShell）
4. 繁體中文，技術名詞保持英文

Brief：
[把 W1-T02 整份 brief 貼進來]
```

## 完成回報模板
```
## W1-T02 完成回報
- ci.yml 路徑與檔案：[貼]
- 各 workspace package.json scripts 加了什麼：[列]
- 本機 npm run ci:typecheck / ci:lint / ci:build 結果：[貼輸出]
- GitHub Actions 跑出來狀態：[綠/黃/紅 + URL]
- 偏離 brief 的決策：[列]
```
