# Codex Task — 統一 Progress 頁卡片視覺與其它頁一致

## 問題（事實）
在 `YPT++ v20.html` 中，Progress 頁的卡片視覺與其它頁（例如 Stats 頁顯示「總學習時間」那種 metric card）不一致。比較：

- **Progress 頁**（`function ProgressPage`，約行 20361 起）使用 CSS class `lerna-progress-card`（此 class 於外部 stylesheet `assets/ypt-tools-v18.css` 定義，而非用 Tailwind utility），底色偏暖/淺米色。
- **Stats 頁**（約行 19756-19790）使用 inline Tailwind：`bg-white border border-[#e5e2dc] rounded-xl p-4`，底色純白。

兩邊 padding、邊框半徑、陰影、底色、字級都可能略有差異，視覺上就會「同一個 app 但感覺不同」。

## 目標
Progress 頁所有卡片的視覺 token 與 Stats 頁/其它頁完全一致：**同底色、同邊框、同圓角、同 padding**。

## 請 Codex 做的事

1. **讀 `assets/ypt-tools-v18.css`**（檔案位於 `C:\Users\hengy\OneDrive\Documents\Claude\Projects\Learning\assets\ypt-tools-v18.css`）。找出 `.lerna-progress-card`、`.lerna-progress-summary`、`.lerna-progress-layout`、`.lerna-progress-meter`、`.lerna-goal-chip`、`.lerna-mastery-chip` 這幾個 class 的實際 CSS。確認它們的 `background`、`border`、`border-radius`、`padding`、`box-shadow` 值。

2. **比對 Stats 頁 metric card 的基準**（以 Tailwind 值為準）：
   - background: `#ffffff`（`bg-white`）
   - border: `1px solid #e5e2dc`（`border border-[#e5e2dc]`）
   - border-radius: `0.75rem`（`rounded-xl`）
   - padding: `1rem`（`p-4`）
   - no shadow, no tinted background

3. **修正方案 A（推薦）**：修改 `ypt-tools-v18.css`，把 `.lerna-progress-card` 的 background/border/border-radius/padding 改成與 Stats metric card 一模一樣。保留 class 名稱以免影響任何 HTML JSX。

   ```css
   .lerna-progress-card {
     background-color: #ffffff;
     border: 1px solid #e5e2dc;
     border-radius: 0.75rem;  /* Tailwind rounded-xl */
     padding: 1rem;           /* Tailwind p-4 */
     box-shadow: none;
   }
   ```

4. **修正方案 B（備案，若無法改 CSS 檔）**：直接在 `YPT++ v20.html` 的 `ProgressPage` JSX 裡把 `className: "lerna-progress-card"` 替換為 Tailwind utility chain `bg-white border border-[#e5e2dc] rounded-xl p-4`。注意：ProgressPage 裡這個 class 出現多處（至少 6-7 處），全部要替換，不要漏掉。

5. **額外檢查點**：
   - `.lerna-progress-summary`（4 格 grid 容器）：確認其 `gap`、`grid-template-columns` 不會讓內部 `.lerna-progress-card` padding 看起來多餘/不夠。
   - 兩個頁面（Progress vs Stats）在同一瀏覽器視窗尺寸下並列，Card 的垂直高度與邊距應該視覺對齊（±1px 以內）。

6. **不要改的事**：
   - 不要改 card 內文字字級、顏色、`uppercase tracking-[0.18em]` label 那一層 label 樣式。
   - 不要改 `lerna-progress-link`（Focus 頁連結到 Progress 的那個 button，這是 v20 新加的）。
   - 不要改 `.lerna-mastery-chip`、`.lerna-goal-chip`（chip 不是 card）。

## 驗收條件
- [ ] 開啟 `YPT++ v20.html`：進入 Stats 頁，記住「總學習時間」卡片的視覺（白底、細米色邊、rounded-xl、p-4）。
- [ ] 切到 Progress 頁，所有卡片（今日專注、目前連續、本週達標率、掌握字卡、今日節奏、掌握與字卡、里程碑、合作進度）與 Stats 卡片**看起來是同一套**：同底色、同邊框、同圓角、同 padding。
- [ ] 其它頁（Focus、Groups、Learn、Settings）的卡片視覺沒有被影響。
- [ ] `grep -c "lerna-progress-card" "YPT++ v20.html"` 在方案 A 下應與修改前相同；方案 B 下應為 0。
- [ ] 若改 CSS，記得相應更新 `assets/ypt-tools-v18.css` 檔並確保 HTML `<link rel="stylesheet" href="./assets/ypt-tools-v18.css">` 仍指向新版。

## 給 Codex 的提示
- 先 `grep -n "lerna-progress-card" "YPT++ v20.html"` 列出所有用到的地方。
- 若選方案 A，用 diff 預覽 CSS 變更；若選方案 B，用 `sed` 或 Python 做批次替換。
- 完成後 `node --check`（對抽出的 module script）再跑一次，確保 HTML 和 JS 皆未壞。
- 用 Chrome 實機比對 Stats vs Progress 視覺。
